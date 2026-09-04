import {
  createDecipheriv,
  createCipheriv,
  createPrivateKey,
  privateDecrypt,
  constants as cryptoConstants,
  type KeyObject,
} from "crypto";
import { CONFIG } from "../../../config";
import { logger } from "../../../services/logger";

const TAG = "[FLOW-CRYPTO]";

/**
 * WhatsApp Flows are end-to-end encrypted. Meta encrypts a one-off AES-128-GCM
 * key with our RSA public key, encrypts the request body with that AES key, and
 * expects the response encrypted with the same key under a flipped IV.
 *
 * See: https://developers.facebook.com/docs/whatsapp/flows/reference/implementingyourflowendpoint
 */
export interface EncryptedFlowRequest {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
}

export interface DecryptedFlowRequest<T = Record<string, unknown>> {
  decryptedBody: T;
  aesKeyBuffer: Buffer;
  initialVectorBuffer: Buffer;
}

/** Meta refuses the endpoint unless a failed decryption answers exactly 421. */
export class FlowDecryptionError extends Error {
  readonly statusCode = 421;
}

let cachedKey: KeyObject | null = null;

function privateKey(): KeyObject {
  if (cachedKey) return cachedKey;
  if (!CONFIG.WHATSAPP_FLOW_PRIVATE_KEY) {
    throw new Error("WHATSAPP_FLOW_PRIVATE_KEY is not configured");
  }
  // Environment variables cannot hold real newlines, so an escaped key is
  // accepted alongside a literal PEM.
  const pem = CONFIG.WHATSAPP_FLOW_PRIVATE_KEY.replace(/\\n/g, "\n");
  cachedKey = createPrivateKey({
    key: pem,
    ...(CONFIG.WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE
      ? { passphrase: CONFIG.WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE }
      : {}),
  });
  return cachedKey;
}

export function decryptFlowRequest<T = Record<string, unknown>>(
  body: EncryptedFlowRequest,
): DecryptedFlowRequest<T> {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;
  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new FlowDecryptionError("The request is missing its encrypted fields");
  }

  let aesKeyBuffer: Buffer;
  try {
    aesKeyBuffer = privateDecrypt(
      {
        key: privateKey(),
        padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64"),
    );
  } catch (error) {
    // Usually means the key pair in Meta no longer matches ours, which Meta
    // expects us to signal with 421 so it re-sends the public key.
    logger.error(`${TAG} Could not decrypt the AES key`, error);
    throw new FlowDecryptionError("Could not decrypt the request key");
  }

  try {
    const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
    const initialVectorBuffer = Buffer.from(initial_vector, "base64");
    // The GCM auth tag is appended to the ciphertext.
    const TAG_LENGTH = 16;
    const ciphertext = flowDataBuffer.subarray(0, -TAG_LENGTH);
    const authTag = flowDataBuffer.subarray(-TAG_LENGTH);

    const decipher = createDecipheriv("aes-128-gcm", aesKeyBuffer, initialVectorBuffer);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return {
      decryptedBody: JSON.parse(decrypted.toString("utf-8")) as T,
      aesKeyBuffer,
      initialVectorBuffer,
    };
  } catch (error) {
    logger.error(`${TAG} Could not decrypt the flow payload`, error);
    throw new FlowDecryptionError("Could not decrypt the request body");
  }
}

/**
 * Encrypts the reply with the request's AES key and the request IV inverted,
 * returned as a bare base64 string — the format Meta expects.
 */
export function encryptFlowResponse(
  response: unknown,
  aesKeyBuffer: Buffer,
  initialVectorBuffer: Buffer,
): string {
  const flippedIv = Buffer.from(initialVectorBuffer.map((byte) => ~byte & 0xff));
  const cipher = createCipheriv("aes-128-gcm", aesKeyBuffer, flippedIv);
  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
