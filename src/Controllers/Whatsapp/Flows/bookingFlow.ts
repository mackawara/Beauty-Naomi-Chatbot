import { CONFIG } from "../../../config";
import { logger } from "../../../services/logger";
import SCHEDULER from "../../../services/scheduler.service";
import FLOW_SESSION from "../../../services/flowSession";
import type { TSchedulerSlot } from "../../../types/types";

const TAG = "[BOOKING-FLOW]";

/** Screen IDs; these must match the Flow JSON published in the Meta dashboard. */
export const SCREENS = {
  SERVICE: "SERVICE",
  SCHEDULE: "SCHEDULE",
  DETAILS: "DETAILS",
  SUMMARY: "SUMMARY",
  SUCCESS: "SUCCESS",
} as const;

/** How many days ahead the date picker offers. */
const DAYS_AHEAD = 14;

export interface FlowRequestPayload {
  version: string;
  action: "INIT" | "BACK" | "data_exchange" | "ping";
  screen?: string;
  data?: Record<string, any>;
  flow_token?: string;
}

export interface FlowScreenResponse {
  version: string;
  screen: string;
  data: Record<string, any>;
}

type Option = { id: string; title: string; description?: string };

function money(priceCents: number, currency: string): string {
  if (!priceCents) return "Price on request";
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(priceCents / 100);
}

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function inTimezone(date: Date, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, ...options }).format(date);
}

/** ISO date (YYYY-MM-DD) for a day offset from today in the salon's timezone. */
function isoDate(offsetDays: number, timezone: string): string {
  const target = new Date(Date.now() + offsetDays * 86_400_000);
  // en-CA renders as YYYY-MM-DD, which is what the scheduler expects.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(target);
}

function dateOptions(timezone: string): Option[] {
  return Array.from({ length: DAYS_AHEAD }, (_, index) => {
    const value = isoDate(index, timezone);
    const label = inTimezone(new Date(`${value}T12:00:00Z`), timezone, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return { id: value, title: index === 0 ? `Today, ${label}` : label };
  });
}

function timeOptions(slots: TSchedulerSlot[], timezone: string): Option[] {
  // WhatsApp caps a dropdown at 200 entries; a salon day never approaches that,
  // but the slice keeps a misconfigured interval from breaking the screen.
  return slots.slice(0, 200).map((slot) => ({
    id: slot.start,
    title: inTimezone(new Date(slot.start), timezone, { hour: "2-digit", minute: "2-digit", hour12: false }),
    description:
      slot.staff.length === 1 ? `with ${slot.staff[0].name}` : `${slot.staff.length} stylists available`,
  }));
}

function screen(name: string, data: Record<string, any>): FlowScreenResponse {
  return { version: "3.0", screen: name, data };
}

/**
 * An error is shown on the screen the customer is already on, rather than
 * dropping them out of the Flow.
 */
function errorOn(name: string, data: Record<string, any>, message: string): FlowScreenResponse {
  return screen(name, { ...data, error_message: message, has_error: true });
}

async function serviceScreen(): Promise<FlowScreenResponse> {
  const services = await SCHEDULER.listServices();
  if (!services.success || !services.data?.length) {
    return errorOn(
      SCREENS.SERVICE,
      { services: [] },
      services.error ?? "No services are bookable right now. Please try again later.",
    );
  }
  return screen(SCREENS.SERVICE, {
    services: services.data.map<Option>((service) => ({
      id: service.id,
      title: service.name,
      description: `${duration(service.baseDurationMinutes)} · ${money(service.priceCents, service.currency)}`,
    })),
  });
}

async function scheduleScreen(
  serviceId: string,
  date: string,
  timezone = CONFIG.SALON_TIMEZONE,
): Promise<FlowScreenResponse> {
  const search = await SCHEDULER.searchSlots(serviceId, date);
  const dates = dateOptions(search.data?.timezone ?? timezone);

  if (!search.success || !search.data) {
    return errorOn(
      SCREENS.SCHEDULE,
      { dates, times: [], selected_date: date, has_times: false },
      search.error ?? "Could not load available times.",
    );
  }

  const times = timeOptions(search.data.slots, search.data.timezone);
  return screen(SCREENS.SCHEDULE, {
    dates: dateOptions(search.data.timezone),
    times,
    selected_date: date,
    has_times: times.length > 0,
    service_name: search.data.service.name,
    // Drives an on-screen hint rather than a dead end when a day is full.
    no_times_message: times.length
      ? ""
      : "Fully booked on this day. Please choose another date.",
  });
}

/**
 * Places the hold before the customer sees the summary, so the slot is theirs
 * while they check the details. The hold expires on its own if they walk away.
 */
async function summaryScreen(flowToken: string): Promise<FlowScreenResponse> {
  const session = await FLOW_SESSION.getSession(flowToken);
  if (!session?.serviceId || !session.slotStartTime) {
    return errorOn(SCREENS.SERVICE, { services: [] }, "This booking timed out. Please start again.");
  }

  const hold = await SCHEDULER.createHold({
    serviceId: session.serviceId,
    slotStartTime: session.slotStartTime,
    customer: { name: session.customerName, phone: session.phone },
    idempotencyKey: session.idempotencyKey,
    // No stylist preference from WhatsApp: the scheduler assigns whoever is free.
    ...(session.staffId ? { staffId: session.staffId } : {}),
  });

  if (!hold.success || !hold.data) {
    // A taken slot is the common case here, and the customer's way out is to
    // pick another time rather than to retry the same one.
    const backToTimes = await scheduleScreen(session.serviceId, session.date ?? isoDate(0, CONFIG.SALON_TIMEZONE));
    return errorOn(
      SCREENS.SCHEDULE,
      backToTimes.data,
      hold.code === "SLOT_UNAVAILABLE"
        ? "Someone just took that time. Please choose another."
        : (hold.error ?? "Could not hold that time."),
    );
  }

  await FLOW_SESSION.updateSession(flowToken, { holdId: hold.data.id });
  const timezone = CONFIG.SALON_TIMEZONE;
  const start = new Date(hold.data.startsAt);

  return screen(SCREENS.SUMMARY, {
    service_name: session.serviceName ?? "Your service",
    when: inTimezone(start, timezone, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    customer_name: session.customerName ?? "",
    phone: session.phone,
    hold_notice: "This time is held for you for a few minutes while you confirm.",
  });
}

async function confirmScreen(flowToken: string): Promise<FlowScreenResponse> {
  const session = await FLOW_SESSION.getSession(flowToken);
  if (!session?.holdId) {
    return errorOn(SCREENS.SERVICE, { services: [] }, "This booking timed out. Please start again.");
  }

  const confirmed = await SCHEDULER.confirmHold(session.holdId);
  if (!confirmed.success || !confirmed.data) {
    return errorOn(
      SCREENS.SUMMARY,
      {
        service_name: session.serviceName ?? "Your service",
        when: "",
        customer_name: session.customerName ?? "",
        phone: session.phone,
        hold_notice: "",
      },
      confirmed.error ?? "Could not confirm the booking. Please try again.",
    );
  }

  await FLOW_SESSION.clearSession(flowToken);
  logger.info(`${TAG} Confirmed booking ${confirmed.data.id} for ${session.phone}`);

  // A terminal screen ends the Flow; the booking id travels back on the
  // nfm_reply so the chat can acknowledge it.
  return screen(SCREENS.SUCCESS, {
    extension_message_response: {
      params: { flow_token: flowToken, booking_id: confirmed.data.id, status: "BOOKED" },
    },
  });
}

/**
 * Routes one decrypted Flow request. Every branch answers with a screen, so a
 * failure never leaves the customer staring at a spinner.
 */
export async function handleBookingFlow(payload: FlowRequestPayload): Promise<FlowScreenResponse | { data: { status: string } }> {
  const { action, screen: currentScreen, data = {}, flow_token: flowToken } = payload;

  // Meta's periodic health check.
  if (action === "ping") return { data: { status: "active" } };

  // Meta forwards client-side errors here; acknowledging stops it retrying.
  if (data.error) {
    logger.error(`${TAG} Client reported an error`, { error: data.error, screen: currentScreen });
    return { data: { status: "acknowledged" } } as { data: { status: string } };
  }

  if (!flowToken) {
    return errorOn(SCREENS.SERVICE, { services: [] }, "This booking session is invalid. Please start again.");
  }

  if (action === "INIT") return serviceScreen();

  if (action === "BACK") {
    if (currentScreen === SCREENS.SCHEDULE) return serviceScreen();
    const session = await FLOW_SESSION.getSession(flowToken);
    if (currentScreen === SCREENS.DETAILS && session?.serviceId) {
      return scheduleScreen(session.serviceId, session.date ?? isoDate(0, CONFIG.SALON_TIMEZONE));
    }
    return serviceScreen();
  }

  switch (currentScreen) {
    case SCREENS.SERVICE: {
      const serviceId = String(data.service_id ?? "");
      if (!serviceId) return errorOn(SCREENS.SERVICE, { services: [] }, "Please choose a service.");
      const services = await SCHEDULER.listServices();
      const chosen = services.data?.find((service) => service.id === serviceId);
      const date = isoDate(0, CONFIG.SALON_TIMEZONE);
      await FLOW_SESSION.updateSession(flowToken, {
        serviceId,
        serviceName: chosen?.name,
        date,
        // Changing the service starts a new attempt, so the hold key rotates.
        idempotencyKey: `wa-${flowToken}-${serviceId}`,
        holdId: undefined,
      });
      return scheduleScreen(serviceId, date);
    }

    case SCREENS.SCHEDULE: {
      const session = await FLOW_SESSION.getSession(flowToken);
      if (!session?.serviceId) {
        return errorOn(SCREENS.SERVICE, { services: [] }, "This booking timed out. Please start again.");
      }
      const date = String(data.selected_date ?? session.date ?? isoDate(0, CONFIG.SALON_TIMEZONE));

      // Picking a date refreshes the times without leaving the screen.
      if (data.trigger === "date_changed" || !data.slot_start) {
        await FLOW_SESSION.updateSession(flowToken, { date, slotStartTime: undefined });
        return scheduleScreen(session.serviceId, date);
      }

      await FLOW_SESSION.updateSession(flowToken, { date, slotStartTime: String(data.slot_start) });
      return screen(SCREENS.DETAILS, {
        service_name: session.serviceName ?? "Your service",
        default_name: session.customerName ?? "",
        phone: session.phone,
      });
    }

    case SCREENS.DETAILS: {
      const customerName = String(data.customer_name ?? "").trim();
      if (!customerName) {
        const session = await FLOW_SESSION.getSession(flowToken);
        return errorOn(
          SCREENS.DETAILS,
          { service_name: session?.serviceName ?? "", default_name: "", phone: session?.phone ?? "" },
          "Please enter your name.",
        );
      }
      await FLOW_SESSION.updateSession(flowToken, { customerName });
      return summaryScreen(flowToken);
    }

    case SCREENS.SUMMARY:
      return confirmScreen(flowToken);

    default:
      return serviceScreen();
  }
}

const BOOKING_FLOW = { handleBookingFlow, SCREENS };
export default BOOKING_FLOW;
