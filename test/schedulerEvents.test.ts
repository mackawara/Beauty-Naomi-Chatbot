import assert from "node:assert/strict";
import crypto from "crypto";
import type { AddressInfo } from "net";
import { after, before, beforeEach, describe, it } from "node:test";
import { setTestEnv } from "./helpers";

setTestEnv();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require("express");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createSchedulerEventsHandler } = require("../src/Controllers/Scheduler/schedulerEvents");

const SECRET = "scheduler-secret";
const booking = {
  id: "appt-1",
  status: "BOOKED",
  startsAt: "2026-10-22T08:30:00.000Z",
  localStart: "2026-10-22T10:30:00.000+02:00",
  service: { id: "svc", name: "Hair Wash", priceCents: 0, currency: "USD" },
  customer: { name: "Chipo", phone: "263771113334" },
};

describe("scheduler webhook consumer", () => {
  let server: import("http").Server;
  let url: string;
  const claimed = new Set<string>();
  let sent: { phone: string; template: string; parameters: string[] }[] = [];
  let updates: { id: string; change: Record<string, unknown> }[] = [];
  let failSend = false;

  before(async () => {
    const app = express();
    app.use(express.json({ verify: (req: { rawBody?: Buffer }, _res: unknown, buf: Buffer) => (req.rawBody = buf) }));
    app.post(
      "/scheduler/events",
      createSchedulerEventsHandler({
        secret: SECRET,
        templates: { reminder: "booking_reminder", cancelled: "booking_cancelled", rescheduled: "booking_rescheduled" },
        claimEvent: async (id: string) => (claimed.has(id) ? false : (claimed.add(id), true)),
        releaseEvent: async (id: string) => {
          claimed.delete(id);
        },
        getBooking: async () => booking,
        sendTemplate: async (phone: string, template: string, parameters: string[]) => {
          if (failSend) {
            throw new Error("WhatsApp down");
          }
          sent.push({ phone, template, parameters });
        },
        updateLocalBooking: async (id: string, change: Record<string, unknown>) => {
          updates.push({ id, change });
        },
      }),
    );
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/scheduler/events`;
  });

  after(() => server.close());
  beforeEach(() => {
    sent = [];
    updates = [];
    failSend = false;
  });

  const deliver = (event: Record<string, unknown>, secret = SECRET) => {
    const body = JSON.stringify(event);
    return fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-scheduler-event-id": String(event.id),
        "x-scheduler-signature": `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`,
      },
      body,
    });
  };
  const event = (id: string, type: string) => ({ id, type, createdAt: "", data: { appointmentId: "appt-1" } });

  it("rejects an invalid signature without messaging", async () => {
    const response = await deliver(event("e-bad", "REMINDER_24H"), "wrong");
    assert.equal(response.status, 401);
    assert.equal(sent.length, 0);
  });

  it("sends a reminder template once, even if the event is delivered twice", async () => {
    assert.equal((await deliver(event("e-1", "REMINDER_24H"))).status, 200);
    assert.equal((await deliver(event("e-1", "REMINDER_24H"))).status, 200);
    assert.deepEqual(sent, [
      { phone: "263771113334", template: "booking_reminder", parameters: ["Chipo", "Hair Wash", "Thu 22 Oct", "10:30"] },
    ]);
  });

  it("marks the local booking cancelled and notifies the customer", async () => {
    await deliver(event("e-2", "BOOKING_CANCELLED"));
    assert.deepEqual(updates, [{ id: "appt-1", change: { status: "CANCELLED" } }]);
    assert.equal(sent[0]?.template, "booking_cancelled");
  });

  it("mirrors a reschedule onto the local booking", async () => {
    await deliver(event("e-3", "BOOKING_RESCHEDULED"));
    assert.equal(updates[0]?.change.bookingTime, "10:30");
    assert.equal(sent[0]?.template, "booking_rescheduled");
  });

  it("returns 500 and allows a retry when sending fails", async () => {
    failSend = true;
    assert.equal((await deliver(event("e-4", "REMINDER_2H"))).status, 500);
    failSend = false;
    assert.equal((await deliver(event("e-4", "REMINDER_2H"))).status, 200);
    assert.equal(sent.length, 1);
  });

  it("acknowledges events that need no message", async () => {
    assert.equal((await deliver(event("e-5", "BOOKING_CREATED"))).status, 200);
    assert.equal(sent.length, 0);
  });
});
