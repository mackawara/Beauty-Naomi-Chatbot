import { Request, Response } from "express";
import { logger } from "../../services/logger";
import { isValidSha256Signature } from "../../UTILS/signatures";
import { SchedulerBookingDetails, SchedulerWebhookEvent } from "../../types/scheduler";
import { formatDay, formatTime } from "../Whatsapp/flows/bookingFlow";

const TAG = "[SCHEDULER-EVENTS]";

export interface SchedulerEventDeps {
  secret: string;
  templates: { reminder: string; cancelled: string; rescheduled: string };
  /** Returns false if the event id was already claimed (duplicate delivery). */
  claimEvent: (eventId: string) => Promise<boolean>;
  releaseEvent: (eventId: string) => Promise<void>;
  getBooking: (appointmentId: string) => Promise<SchedulerBookingDetails>;
  sendTemplate: (phone: string, template: string, parameters: string[]) => Promise<void>;
  updateLocalBooking: (
    appointmentId: string,
    change: { status?: "CANCELLED"; bookingDate?: Date; bookingTime?: string },
  ) => Promise<void>;
}

/** Template and body parameters for an event, or null when the event needs no customer message. */
const messageFor = (event: SchedulerWebhookEvent, booking: SchedulerBookingDetails, deps: SchedulerEventDeps) => {
  const service = booking.service?.name ?? "appointment";
  const day = formatDay(booking.localStart.slice(0, 10));
  const time = formatTime(booking.localStart);
  switch (event.type) {
    case "REMINDER_24H":
    case "REMINDER_2H":
      return booking.status === "BOOKED"
        ? { template: deps.templates.reminder, parameters: [booking.customer?.name || "there", service, day, time] }
        : null;
    case "BOOKING_CANCELLED":
      return { template: deps.templates.cancelled, parameters: [service, day, time] };
    case "BOOKING_RESCHEDULED":
      return { template: deps.templates.rescheduled, parameters: [service, day, time] };
    default:
      return null;
  }
};

const HANDLED_EVENTS = ["REMINDER_24H", "REMINDER_2H", "BOOKING_CANCELLED", "BOOKING_RESCHEDULED"];

/**
 * Receives scheduler notification webhooks: verifies the signature, ignores duplicate deliveries,
 * mirrors cancellations/reschedules onto the local booking and messages the customer.
 * Answers 2xx only once handled, so the scheduler retries transient failures.
 */
export const createSchedulerEventsHandler = (deps: SchedulerEventDeps) => async (req: Request, res: Response) => {
  if (!isValidSha256Signature(req.rawBody, req.get("x-scheduler-signature"), deps.secret)) {
    logger.warn(`${TAG} Rejected event with an invalid signature`);
    return res.status(401).json({ success: false });
  }
  const event = req.body as SchedulerWebhookEvent;
  if (!HANDLED_EVENTS.includes(event.type) || !event.data?.appointmentId) {
    // BOOKING_CREATED is confirmed by the Flow itself; OTP/waitlist events are not used yet.
    return res.status(200).json({ success: true, ignored: true });
  }
  if (!(await deps.claimEvent(event.id))) {
    logger.info(`${TAG} Duplicate delivery of ${event.type} ${event.id} ignored`);
    return res.status(200).json({ success: true, duplicate: true });
  }

  try {
    const booking = await deps.getBooking(event.data.appointmentId);
    if (event.type === "BOOKING_CANCELLED") {
      await deps.updateLocalBooking(booking.id, { status: "CANCELLED" });
    } else if (event.type === "BOOKING_RESCHEDULED") {
      await deps.updateLocalBooking(booking.id, {
        bookingDate: new Date(booking.startsAt),
        bookingTime: formatTime(booking.localStart),
      });
    }
    const message = messageFor(event, booking, deps);
    const phone = booking.customer?.phone;
    if (message && phone) {
      await deps.sendTemplate(phone, message.template, message.parameters);
    } else if (message) {
      logger.warn(`${TAG} Booking ${booking.id} has no phone number; ${event.type} not sent`);
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    await deps.releaseEvent(event.id).catch(() => undefined);
    logger.error(`${TAG} Failed to handle ${event.type} ${event.id}`, error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false });
  }
};
