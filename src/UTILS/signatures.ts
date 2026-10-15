import crypto from "crypto";

/**
 * Validates a "sha256=<hex HMAC-SHA256 of the raw body>" signature header.
 * Used for Meta's X-Hub-Signature-256 and the scheduler's x-scheduler-signature.
 */
export const isValidSha256Signature = (rawBody: Buffer | undefined, header: string | undefined, secret: string) => {
  if (!rawBody || !secret || !header?.startsWith("sha256=")) {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(header.slice("sha256=".length), "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
};
