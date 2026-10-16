import crypto from "crypto";

export { decryptResponseLikeWhatsApp, encryptLikeWhatsApp } from "../scripts/flowClient";

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
    SCHEDULER_API_URL: "http://127.0.0.1:1",
    SCHEDULER_API_KEY: "sk_test",
    WHATSAPP_APP_SECRET: "app-secret",
    WHATSAPP_FLOW_PRIVATE_KEY: "unused",
    WHATSAPP_BOOKING_FLOW_ID: "flow-id",
    SCHEDULER_WEBHOOK_SECRET: "scheduler-secret",
    ...overrides,
  });
};
