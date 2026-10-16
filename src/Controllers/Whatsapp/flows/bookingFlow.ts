import { logger } from "../../../services/logger";
import { SchedulerError } from "../../../services/schedulerService";
import type schedulerService from "../../../services/schedulerService";
import { BookingFlowContext, FlowContextStore } from "../../../services/flowContext";
import { SchedulerBookingView, SchedulerSlots } from "../../../types/scheduler";
import { FlowRequest, FlowScreenResponse } from "../../../types/flows";
import { registerFlowHandler } from "./flowRouter";

const TAG = "[BOOKING-FLOW]";
const BOOK_SCREEN = "BOOK";
const SUCCESS_SCREEN = "SUCCESS";
const DAYS_AHEAD = 14;
const SLOT_TAKEN_CODES = ["SLOT_UNAVAILABLE", "HOLD_EXPIRED"];
// Dropdowns need a non-empty data source, so empty lists get a hidden placeholder.
const PLACEHOLDER = [{ id: "none", title: "None available" }];

type Option = { id: string; title: string };

export interface ConfirmedBooking {
  context: BookingFlowContext;
  flowToken: string;
  booking: SchedulerBookingView;
  customerName: string;
}

export interface BookingFlowDeps {
  scheduler: Pick<typeof schedulerService, "getAvailableDates" | "getSlots" | "holdSlot" | "confirmHold">;
  contexts: FlowContextStore;
  /** Persists/notifies after a successful booking and returns the SUCCESS summary text. */
  onConfirmed: (confirmed: ConfirmedBooking) => Promise<string>;
}

/** "Tue 20 Oct" for a local YYYY-MM-DD date. */
export const formatDay = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );

/** "09:00" from a scheduler localStart (already in the salon's timezone). */
export const formatTime = (localStart: string) => localStart.slice(11, 16);

const plural = (count: number) => `${count} ${count === 1 ? "time" : "times"}`;

const bookScreen = (input: {
  context: BookingFlowContext | null;
  dates: Option[];
  selectedDate?: string;
  slots: Option[];
  slotMessage: string;
  customerName?: string;
}): FlowScreenResponse => ({
  screen: BOOK_SCREEN,
  data: {
    service_name: input.context?.serviceName ?? "Booking",
    service_details: input.context?.serviceDetails ?? "",
    dates: input.dates.length ? input.dates : PLACEHOLDER,
    has_dates: input.dates.length > 0,
    selected_date: input.selectedDate ?? input.dates[0]?.id ?? PLACEHOLDER[0]!.id,
    slots: input.slots.length ? input.slots : PLACEHOLDER,
    has_slots: input.slots.length > 0,
    slot_message: input.slotMessage,
    customer_name: input.customerName ?? input.context?.customerName ?? "",
  },
});

const expiredScreen = () =>
  bookScreen({
    context: null,
    dates: [],
    slots: [],
    slotMessage: "This booking link has expired. Send *hi* in the chat to start again.",
  });

const slotOptions = (result: SchedulerSlots): Option[] =>
  result.slots.map((slot) => ({ id: slot.start, title: formatTime(slot.localStart) }));

const stringField = (data: FlowRequest["data"], field: string) => {
  const value = data?.[field];
  return typeof value === "string" ? value.trim() : "";
};

export const createBookingFlowHandlers = (deps: BookingFlowDeps) => {
  const loadDates = async (context: BookingFlowContext): Promise<Option[]> => {
    const summary = await deps.scheduler.getAvailableDates(context.serviceId, DAYS_AHEAD);
    return summary.dates.map((entry) => ({
      id: entry.date,
      title: `${formatDay(entry.date)} · ${plural(entry.availableSlots)}`,
    }));
  };

  /** BOOK screen for one date, with fresh dates and times. */
  const renderDate = async (
    context: BookingFlowContext,
    requestedDate: string | undefined,
    customerName: string | undefined,
    message?: string,
  ): Promise<FlowScreenResponse> => {
    const dates = await loadDates(context);
    if (!dates.length) {
      return bookScreen({
        context,
        dates,
        slots: [],
        customerName,
        slotMessage: `Sorry, we're fully booked for the next ${DAYS_AHEAD} days. Please check again soon.`,
      });
    }
    const selectedDate = dates.some((date) => date.id === requestedDate) ? requestedDate! : dates[0]!.id;
    const slots = slotOptions(await deps.scheduler.getSlots(context.serviceId, selectedDate));
    return bookScreen({
      context,
      dates,
      selectedDate,
      slots,
      customerName,
      slotMessage:
        message ??
        (slots.length ? `Open times on ${formatDay(selectedDate)}:` : `No times left on ${formatDay(selectedDate)}. Try another date.`),
    });
  };

  const withContext = async (
    request: FlowRequest,
    work: (context: BookingFlowContext) => Promise<FlowScreenResponse>,
  ): Promise<FlowScreenResponse> => {
    const context = request.flow_token ? await deps.contexts.get(request.flow_token) : null;
    if (!context) {
      return expiredScreen();
    }
    try {
      return await work(context);
    } catch (error) {
      logger.error(`${TAG} ${request.action} failed`, error instanceof SchedulerError ? error.code : error);
      return bookScreen({
        context,
        dates: [],
        slots: [],
        customerName: stringField(request.data, "name") || undefined,
        slotMessage: "Sorry, we couldn't load times right now. Please close this form and try again.",
      });
    }
  };

  const init = (request: FlowRequest) => withContext(request, (context) => renderDate(context, undefined, undefined));

  const dateSelected = (request: FlowRequest) =>
    withContext(request, (context) =>
      renderDate(context, stringField(request.data, "date"), stringField(request.data, "name") || undefined),
    );

  const confirm = (request: FlowRequest) =>
    withContext(request, async (context) => {
      const date = stringField(request.data, "date");
      const slot = stringField(request.data, "slot");
      const customerName = stringField(request.data, "name") || context.customerName || "";
      if (!slot || slot === PLACEHOLDER[0]!.id) {
        return renderDate(context, date, customerName, "Please pick a time first.");
      }
      const flowToken = request.flow_token!;
      try {
        const holdInput = {
          serviceId: context.serviceId,
          slotStartTime: slot,
          customer: { name: customerName, phone: context.phone },
          idempotencyKey: `${flowToken}:${slot}`,
        };
        let hold = await deps.scheduler.holdSlot(holdInput);
        if (hold.status === "EXPIRED" || hold.status === "CANCELLED") {
          // A replayed key returns the old, dead hold; take a fresh one for the same time.
          hold = await deps.scheduler.holdSlot({ ...holdInput, idempotencyKey: `${holdInput.idempotencyKey}:${Date.now()}` });
        }
        const booking = hold.status === "BOOKED" ? hold : await deps.scheduler.confirmHold(hold.id);
        const summary = await deps.onConfirmed({ context, flowToken, booking, customerName });
        return { screen: SUCCESS_SCREEN, data: { summary, booking_id: context.bookingId } };
      } catch (error) {
        if (error instanceof SchedulerError && SLOT_TAKEN_CODES.includes(error.code)) {
          logger.info(`${TAG} Slot ${slot} was taken before confirmation`);
          return renderDate(context, date, customerName, "Sorry, that time was just taken. Please pick another time.");
        }
        throw error;
      }
    });

  return { init, dateSelected, confirm };
};

export const registerBookingFlow = (deps: BookingFlowDeps) => {
  const handlers = createBookingFlowHandlers(deps);
  registerFlowHandler("INIT", handlers.init);
  registerFlowHandler("BACK", handlers.init);
  registerFlowHandler(`data_exchange:${BOOK_SCREEN}:date_selected`, handlers.dateSelected);
  registerFlowHandler(`data_exchange:${BOOK_SCREEN}:confirm`, handlers.confirm);
};
