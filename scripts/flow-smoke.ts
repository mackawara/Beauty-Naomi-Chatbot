/**
 * Local smoke test for the booking Flow: plays the WhatsApp client against a running bot.
 *
 *   yarn smoke:flow ping
 *   yarn smoke:flow init    <flow_token>
 *   yarn smoke:flow date    <flow_token> <YYYY-MM-DD>
 *   yarn smoke:flow confirm <flow_token> <YYYY-MM-DD> <slot id> [name]
 *   yarn smoke:flow journey <flow_token> [name]   (INIT → first date → first time → confirm)
 *
 * Reads WHATSAPP_FLOW_PRIVATE_KEY(+_PASSPHRASE) and WHATSAPP_APP_SECRET from .env (the public key is
 * derived from the private key). FLOW_ENDPOINT_URL defaults to http://localhost:$PORT/whatsapp/flows.
 */
import crypto from "crypto";
import path from "path";
import * as dotenv from "dotenv";
import { sendFlowRequest } from "./flowClient";

dotenv.config({ path: path.join(__dirname, "../.env") });

const privatePem = (process.env.WHATSAPP_FLOW_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
const url = process.env.FLOW_ENDPOINT_URL ?? `http://localhost:${process.env.PORT || 3000}/whatsapp/flows`;

if (!privatePem || !appSecret) {
  console.error("Set WHATSAPP_FLOW_PRIVATE_KEY and WHATSAPP_APP_SECRET in .env first.");
  process.exit(1);
}

const publicKey = crypto.createPublicKey(
  crypto.createPrivateKey({ key: privatePem, passphrase: process.env.WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE || undefined }),
);

type Option = { id: string; title: string };
type ScreenResponse = { screen?: string; data: Record<string, unknown> };

const send = async (body: Record<string, unknown>): Promise<ScreenResponse> => {
  const result = await sendFlowRequest({ url, body: { version: "3.0", ...body }, publicKey, appSecret });
  if (result.status !== 200) {
    throw new Error(`HTTP ${result.status} from ${url} ${typeof result.body === "string" ? result.body : ""}`);
  }
  return result.body as ScreenResponse;
};

const show = (label: string, response: ScreenResponse) => {
  console.log(`\n── ${label} → ${response.screen ?? "(no screen)"}`);
  const { dates, slots, ...rest } = response.data;
  for (const [key, value] of Object.entries(rest)) {
    console.log(`   ${key}: ${JSON.stringify(value)}`);
  }
  if (Array.isArray(dates) && response.data.has_dates) {
    console.log(`   dates: ${(dates as Option[]).map((date) => `${date.id} (${date.title})`).join(", ")}`);
  }
  if (Array.isArray(slots) && response.data.has_slots) {
    console.log("   slots:");
    (slots as Option[]).forEach((slot) => console.log(`     ${slot.title}  id=${slot.id}`));
  }
  return response;
};

const exchange = (flowToken: string, data: Record<string, unknown>) =>
  send({ action: "data_exchange", screen: "BOOK", flow_token: flowToken, data });

const main = async () => {
  const [command, flowToken, ...args] = process.argv.slice(2);
  switch (command) {
    case "ping":
      show("ping", await send({ action: "ping" }));
      return;
    case "init":
      show("INIT", await send({ action: "INIT", flow_token: flowToken }));
      return;
    case "date":
      show(`date_selected ${args[0]}`, await exchange(flowToken!, { trigger: "date_selected", date: args[0] }));
      return;
    case "confirm":
      show(
        "confirm",
        await exchange(flowToken!, { trigger: "confirm", date: args[0], slot: args[1], name: args[2] ?? "Smoke Test" }),
      );
      return;
    case "journey": {
      const init = show("INIT", await send({ action: "INIT", flow_token: flowToken }));
      const date = (init.data.dates as Option[] | undefined)?.[0];
      if (!init.data.has_dates || !date) throw new Error("No dates with availability; check working hours and blocks.");
      const day = show(`date_selected ${date.id}`, await exchange(flowToken!, { trigger: "date_selected", date: date.id }));
      const slot = (day.data.slots as Option[] | undefined)?.[0];
      if (!day.data.has_slots || !slot) throw new Error(`No open times on ${date.id}.`);
      show(
        `confirm ${date.id} ${slot.title}`,
        await exchange(flowToken!, { trigger: "confirm", date: date.id, slot: slot.id, name: args[0] ?? "Smoke Test" }),
      );
      return;
    }
    default:
      console.log("Usage: yarn smoke:flow <ping|init|date|confirm|journey> [flow_token] [...]");
      process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
