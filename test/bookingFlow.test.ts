import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, it } from "node:test";
import { setTestEnv } from "./helpers";

setTestEnv();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createBookingFlowHandlers } = require("../src/Controllers/Whatsapp/flows/bookingFlow");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SchedulerError } = require("../src/services/schedulerService");

const declaredBookKeys = Object.keys(
  (JSON.parse(readFileSync(join(__dirname, "../flows/booking.json"), "utf-8")) as {
    screens: { id: string; data: Record<string, unknown> }[];
  }).screens.find((screen) => screen.id === "BOOK")!.data,
).sort();

const context = {
  phone: "263771234567",
  serviceId: "svc",
  serviceName: "Hair Wash",
  serviceDetails: "60 min · USD 15.00",
  bookingId: "BN-7",
  customerName: "Rudo",
};

const slot = (date: string, hhmm: string) => ({
  start: `${date}T${hhmm}:00.000Z`,
  serviceEnd: "",
  endWithBuffer: "",
  localStart: `${date}T${hhmm}:00.000+02:00`,
});

const makeFakes = () => {
  const open: Record<string, ReturnType<typeof slot>[]> = {
    "2026-10-20": [slot("2026-10-20", "09:00"), slot("2026-10-20", "10:00")],
    "2026-10-21": [slot("2026-10-21", "11:00")],
  };
  const holds = new Map<string, { id: string; status: string; start: string }>();
  const calls = { confirm: 0, onConfirmed: 0 };
  const scheduler = {
    getAvailableDates: async () => ({
      timezone: "Africa/Harare",
      dates: Object.entries(open)
        .filter(([, slots]) => slots.length)
        .map(([date, slots]) => ({ date, availableSlots: slots.length })),
    }),
    getSlots: async (_: string, date: string) => ({ date, timezone: "Africa/Harare", slots: open[date] ?? [] }),
    holdSlot: async (input: { slotStartTime: string; idempotencyKey: string }) => {
      const existing = holds.get(input.idempotencyKey);
      if (existing) {
        return existing;
      }
      const date = input.slotStartTime.slice(0, 10);
      const index = (open[date] ?? []).findIndex((entry) => entry.start === input.slotStartTime);
      if (index < 0) {
        throw new SchedulerError("SLOT_UNAVAILABLE", "taken", 409);
      }
      open[date]!.splice(index, 1);
      const hold = { id: `hold-${holds.size + 1}`, status: "HOLD", start: input.slotStartTime, startsAt: input.slotStartTime };
      holds.set(input.idempotencyKey, hold);
      return hold;
    },
    confirmHold: async (holdId: string) => {
      calls.confirm += 1;
      const hold = [...holds.values()].find((entry) => entry.id === holdId)!;
      hold.status = "BOOKED";
      return hold;
    },
  };
  const contexts = {
    get: async (token: string) => (token === "valid-token" ? context : null),
    delete: async () => undefined,
  };
  const onConfirmed = async () => {
    calls.onConfirmed += 1;
    return "Hair Wash\nTue 20 Oct at 09:00";
  };
  return { open, calls, handlers: createBookingFlowHandlers({ scheduler, contexts, onConfirmed }) };
};

const request = (action: string, data?: Record<string, unknown>, flow_token = "valid-token") => ({
  version: "3.0",
  action,
  screen: action === "INIT" ? undefined : "BOOK",
  data,
  flow_token,
});

describe("booking Flow handlers", () => {
  let fakes: ReturnType<typeof makeFakes>;
  beforeEach(() => {
    fakes = makeFakes();
  });

  it("INIT returns the BOOK screen with dates and the first date's times", async () => {
    const response = await fakes.handlers.init(request("INIT"));
    assert.equal(response.screen, "BOOK");
    assert.deepEqual(Object.keys(response.data).sort(), declaredBookKeys);
    assert.deepEqual(response.data.dates, [
      { id: "2026-10-20", title: "Tue 20 Oct · 2 times" },
      { id: "2026-10-21", title: "Wed 21 Oct · 1 time" },
    ]);
    assert.equal(response.data.selected_date, "2026-10-20");
    assert.deepEqual(response.data.slots, [
      { id: "2026-10-20T09:00:00.000Z", title: "09:00" },
      { id: "2026-10-20T10:00:00.000Z", title: "10:00" },
    ]);
    assert.equal(response.data.customer_name, "Rudo");
  });

  it("picking a date reloads that date's times on the same screen", async () => {
    const response = await fakes.handlers.dateSelected(request("data_exchange", { trigger: "date_selected", date: "2026-10-21", name: "Tari" }));
    assert.equal(response.screen, "BOOK");
    assert.equal(response.data.selected_date, "2026-10-21");
    assert.deepEqual(response.data.slots, [{ id: "2026-10-21T11:00:00.000Z", title: "11:00" }]);
    assert.equal(response.data.customer_name, "Tari");
  });

  it("only offers open times: a time taken elsewhere disappears on the next date pick", async () => {
    fakes.open["2026-10-20"]!.shift();
    const response = await fakes.handlers.dateSelected(request("data_exchange", { trigger: "date_selected", date: "2026-10-20" }));
    assert.deepEqual(response.data.slots, [{ id: "2026-10-20T10:00:00.000Z", title: "10:00" }]);
  });

  it("confirm holds and confirms, then shows SUCCESS", async () => {
    const response = await fakes.handlers.confirm(
      request("data_exchange", { trigger: "confirm", date: "2026-10-20", slot: "2026-10-20T09:00:00.000Z", name: "Rudo" }),
    );
    assert.deepEqual(response, { screen: "SUCCESS", data: { summary: "Hair Wash\nTue 20 Oct at 09:00", booking_id: "BN-7" } });
    assert.equal(fakes.calls.confirm, 1);
  });

  it("a double tap on confirm creates a single booking", async () => {
    const data = { trigger: "confirm", date: "2026-10-20", slot: "2026-10-20T09:00:00.000Z", name: "Rudo" };
    await fakes.handlers.confirm(request("data_exchange", data));
    const second = await fakes.handlers.confirm(request("data_exchange", data));
    assert.equal(second.screen, "SUCCESS");
    assert.equal(fakes.calls.confirm, 1);
    assert.equal(fakes.open["2026-10-20"]!.length, 1);
  });

  it("when the time was just taken, shows refreshed times and a message", async () => {
    fakes.open["2026-10-20"]!.shift();
    const response = await fakes.handlers.confirm(
      request("data_exchange", { trigger: "confirm", date: "2026-10-20", slot: "2026-10-20T09:00:00.000Z", name: "Rudo" }),
    );
    assert.equal(response.screen, "BOOK");
    assert.match(String(response.data.slot_message), /just taken/);
    assert.deepEqual(response.data.slots, [{ id: "2026-10-20T10:00:00.000Z", title: "10:00" }]);
  });

  it("asks for a time when none was picked", async () => {
    const response = await fakes.handlers.confirm(request("data_exchange", { trigger: "confirm", date: "2026-10-20", slot: "none" }));
    assert.equal(response.screen, "BOOK");
    assert.match(String(response.data.slot_message), /pick a time/);
  });

  it("hides the pickers when fully booked", async () => {
    fakes.open["2026-10-20"] = [];
    fakes.open["2026-10-21"] = [];
    const response = await fakes.handlers.init(request("INIT"));
    assert.equal(response.data.has_dates, false);
    assert.equal(response.data.has_slots, false);
    assert.match(String(response.data.slot_message), /fully booked/);
  });

  it("explains an expired booking link", async () => {
    const response = await fakes.handlers.init(request("INIT", undefined, "expired-token"));
    assert.equal(response.screen, "BOOK");
    assert.equal(response.data.has_dates, false);
    assert.match(String(response.data.slot_message), /expired/);
  });
});
