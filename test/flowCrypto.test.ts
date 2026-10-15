import assert from "node:assert/strict";
import crypto from "crypto";
import { describe, it } from "node:test";
import {
  decryptFlowRequest,
  encryptFlowResponse,
  FlowDecryptionError,
  isValidMetaSignature,
} from "../src/Controllers/Whatsapp/flows/flowCrypto";
import { decryptResponseLikeWhatsApp, encryptLikeWhatsApp, testKeyPair } from "./helpers";

describe("Flow endpoint encryption", () => {
  const { publicKey, privateKey } = testKeyPair();

  it("decrypts a WhatsApp request and encrypts a response the client can read", () => {
    const request = { version: "3.0", action: "INIT", flow_token: "token-1" };
    const { payload, aesKey, iv } = encryptLikeWhatsApp(request, publicKey);
    const decrypted = decryptFlowRequest(payload, privateKey);
    assert.deepEqual(decrypted.body, request);

    const response = { screen: "BOOK", data: { service_name: "Hair Wash" } };
    const encrypted = encryptFlowResponse(response, decrypted.aesKey, decrypted.initialVector);
    assert.deepEqual(decryptResponseLikeWhatsApp(encrypted, aesKey, iv), response);
  });

  it("rejects payloads encrypted for another key", () => {
    const other = testKeyPair();
    const { payload } = encryptLikeWhatsApp({ action: "ping" }, other.publicKey);
    assert.throws(() => decryptFlowRequest(payload, privateKey), FlowDecryptionError);
  });

  it("rejects tampered ciphertext", () => {
    const { payload } = encryptLikeWhatsApp({ action: "ping" }, publicKey);
    const data = Buffer.from(payload.encrypted_flow_data, "base64");
    data[0] = data[0]! ^ 0xff;
    assert.throws(
      () => decryptFlowRequest({ ...payload, encrypted_flow_data: data.toString("base64") }, privateKey),
      FlowDecryptionError,
    );
  });
});

describe("Meta signature validation", () => {
  const body = Buffer.from('{"hello":"world"}');
  const signature = `sha256=${crypto.createHmac("sha256", "secret").update(body).digest("hex")}`;

  it("accepts a valid signature", () => {
    assert.equal(isValidMetaSignature(body, signature, "secret"), true);
  });

  it("rejects wrong, malformed or missing signatures", () => {
    assert.equal(isValidMetaSignature(body, signature, "other-secret"), false);
    assert.equal(isValidMetaSignature(body, "sha256=abcd", "secret"), false);
    assert.equal(isValidMetaSignature(body, undefined, "secret"), false);
    assert.equal(isValidMetaSignature(undefined, signature, "secret"), false);
  });
});
