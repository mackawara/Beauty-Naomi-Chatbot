import crypto from "crypto";

/** Encrypts a Flow request exactly like the WhatsApp client does, for tests. */
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

export const testKeyPair = () => crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

/** Minimal env so modules that import CONFIG can load in tests. */
export const setTestEnv = (overrides: Record<string, string> = {}) => {
  Object.assign(process.env, {
    APP_ENV: "test",
    PORT: "0",
    MONGODB_PASSWORD: "x",
    MONGODB_USERNAME: "x",
    MONGODB_HOST: "x",
    WHATSAPP_WEBHOOK_VERIFICATION_TOKEN: "verify",
    WHATSAPP_PHONE_NUMBER_ID: "123",
    WHATSAPP_SYSTEM_TOKEN: "token",
    CALCOM_API_KEY: "x",
    CALCOM_VERSION: "2",
    CALCOM_API_VERSION: "x",
    CALCOM_API_VERSION_BOOKING: "x",
    SCHEDULER_API_URL: "http://127.0.0.1:1",
    SCHEDULER_API_KEY: "sk_test",
    WHATSAPP_APP_SECRET: "app-secret",
    WHATSAPP_FLOW_PRIVATE_KEY: "unused",
    WHATSAPP_BOOKING_FLOW_ID: "flow-id",
    SCHEDULER_WEBHOOK_SECRET: "scheduler-secret",
    ...overrides,
  });
};
