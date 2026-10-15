import crypto from "crypto";
import { EncryptedFlowRequest, FlowRequest } from "../../../types/flows";
import { isValidSha256Signature } from "../../../UTILS/signatures";

const TAG_LENGTH = 16;

/** Thrown when a Flow request cannot be decrypted; the endpoint answers 421 so WhatsApp refreshes our public key. */
export class FlowDecryptionError extends Error {}

export interface DecryptedFlowRequest {
  body: FlowRequest;
  aesKey: Buffer;
  initialVector: Buffer;
}

/** RSA-OAEP(SHA-256) unwraps the AES key, then AES-128-GCM decrypts the Flow payload. */
export const decryptFlowRequest = (
  payload: EncryptedFlowRequest,
  privateKey: crypto.KeyObject,
): DecryptedFlowRequest => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = payload;
  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new FlowDecryptionError("Missing encrypted Flow fields");
  }
  try {
    const aesKey = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      Buffer.from(encrypted_aes_key, "base64"),
    );
    const flowData = Buffer.from(encrypted_flow_data, "base64");
    const initialVector = Buffer.from(initial_vector, "base64");
    const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, initialVector);
    decipher.setAuthTag(flowData.subarray(-TAG_LENGTH));
    const json = Buffer.concat([decipher.update(flowData.subarray(0, -TAG_LENGTH)), decipher.final()]).toString("utf-8");
    return { body: JSON.parse(json) as FlowRequest, aesKey, initialVector };
  } catch (error) {
    throw new FlowDecryptionError(error instanceof Error ? error.message : "Could not decrypt Flow request");
  }
};

/** Encrypts the response with the request's AES key and the bit-flipped IV, as WhatsApp requires. */
export const encryptFlowResponse = (response: unknown, aesKey: Buffer, initialVector: Buffer): string => {
  const flippedIv = Buffer.from(initialVector.map((byte) => ~byte & 0xff));
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIv);
  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
};

/** Validates Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with the app secret). */
export const isValidMetaSignature = isValidSha256Signature;

/** Loads the PEM private key from env (supports "\n"-escaped single-line values). */
export const loadPrivateKey = (pem: string, passphrase?: string) =>
  crypto.createPrivateKey({ key: pem.replace(/\\n/g, "\n"), passphrase: passphrase || undefined });
