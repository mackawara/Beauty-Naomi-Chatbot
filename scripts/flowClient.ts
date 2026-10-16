import crypto from "crypto";

// Plays the WhatsApp client side of the Flows data endpoint protocol.
// Used by the tests and by scripts/flow-smoke.ts.

/** Encrypts a Flow request exactly like the WhatsApp client does. */
export const encryptLikeWhatsApp = (body: unknown, publicKey: crypto.KeyObject) => {
  const aesKey = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(body), "utf-8"), cipher.final(), cipher.getAuthTag()]);
  return {
    aesKey,
    iv,
    payload: {
      encrypted_flow_data: encrypted.toString("base64"),
      encrypted_aes_key: crypto
        .publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, aesKey)
        .toString("base64"),
      initial_vector: iv.toString("base64"),
    },
  };
};

/** Decrypts an endpoint response like the WhatsApp client (bit-flipped IV). */
export const decryptResponseLikeWhatsApp = (base64: string, aesKey: Buffer, iv: Buffer) => {
  const data = Buffer.from(base64, "base64");
  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, Buffer.from(iv.map((byte) => ~byte & 0xff)));
  decipher.setAuthTag(data.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]).toString("utf-8"));
};

/** Sends one encrypted, signed Flow request and returns the HTTP status and decrypted response. */
export const sendFlowRequest = async (input: {
  url: string;
  body: unknown;
  publicKey: crypto.KeyObject;
  appSecret: string;
}) => {
  const { payload, aesKey, iv } = encryptLikeWhatsApp(input.body, input.publicKey);
  const raw = JSON.stringify(payload);
  const response = await fetch(input.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${crypto.createHmac("sha256", input.appSecret).update(raw).digest("hex")}`,
    },
    body: raw,
  });
  const text = await response.text();
  return {
    status: response.status,
    body: response.ok ? decryptResponseLikeWhatsApp(text, aesKey, iv) : text,
  };
};
