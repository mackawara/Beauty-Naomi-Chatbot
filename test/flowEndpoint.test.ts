import assert from "node:assert/strict";
import crypto from "crypto";
import type { AddressInfo } from "net";
import { after, before, describe, it } from "node:test";
import { decryptResponseLikeWhatsApp, encryptLikeWhatsApp, setTestEnv, testKeyPair } from "./helpers";

const { publicKey, privateKey } = testKeyPair();
setTestEnv({ WHATSAPP_FLOW_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString() });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require("express");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { flowDataEndpoint } = require("../src/Controllers/Whatsapp/flows/flowEndpoint");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { registerFlowHandler } = require("../src/Controllers/Whatsapp/flows/flowRouter");

describe("Flow data endpoint", () => {
  let server: import("http").Server;
  let url: string;

  before(async () => {
    const app = express();
    app.use(express.json({ verify: (req: { rawBody?: Buffer }, _res: unknown, buf: Buffer) => (req.rawBody = buf) }));
    app.post("/flows", flowDataEndpoint);
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/flows`;
    registerFlowHandler("data_exchange:BOOK:echo", async (request: { data: unknown }) => ({
      screen: "BOOK",
      data: { echoed: request.data },
    }));
  });

  after(() => server.close());

  const post = (payload: unknown, secret = "app-secret") => {
    const body = JSON.stringify(payload);
    const signature = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature },
      body,
    });
  };

  it("answers the health-check ping", async () => {
    const { payload, aesKey, iv } = encryptLikeWhatsApp({ version: "3.0", action: "ping" }, publicKey);
    const response = await post(payload);
    assert.equal(response.status, 200);
    assert.deepEqual(decryptResponseLikeWhatsApp(await response.text(), aesKey, iv), { data: { status: "active" } });
  });

  it("routes data_exchange by screen and trigger", async () => {
    const request = { version: "3.0", action: "data_exchange", screen: "BOOK", data: { trigger: "echo", x: 1 }, flow_token: "t" };
    const { payload, aesKey, iv } = encryptLikeWhatsApp(request, publicKey);
    const response = await post(payload);
    assert.deepEqual(decryptResponseLikeWhatsApp(await response.text(), aesKey, iv), {
      screen: "BOOK",
      data: { echoed: { trigger: "echo", x: 1 } },
    });
  });

  it("acknowledges client error notifications", async () => {
    const request = { version: "3.0", action: "data_exchange", screen: "BOOK", data: { error: "boom", error_message: "x" } };
    const { payload, aesKey, iv } = encryptLikeWhatsApp(request, publicKey);
    const response = await post(payload);
    assert.deepEqual(decryptResponseLikeWhatsApp(await response.text(), aesKey, iv), { data: { acknowledged: true } });
  });

  it("returns 432 for a bad signature and 421 for an undecryptable body", async () => {
    const { payload } = encryptLikeWhatsApp({ action: "ping" }, publicKey);
    assert.equal((await post(payload, "wrong-secret")).status, 432);
    const other = testKeyPair();
    assert.equal((await post(encryptLikeWhatsApp({ action: "ping" }, other.publicKey).payload)).status, 421);
  });
});
