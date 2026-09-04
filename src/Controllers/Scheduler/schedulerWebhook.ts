import { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { CONFIG } from "../../config";
import { logger } from "../../services/logger";
import { RedisService } from "../../services/redis";
import SCHEDULER from "../../services/scheduler.service";
import whatsappMessager from "../Whatsapp/outgoingWhatsappMessagesHandler";
import { longWhen } from "../Whatsapp/booking/bookingConversation";
import type { SchedulerWebhookEvent } from "../../types/types";

const TAG = "[SCHEDULER-WEBHOOK]";
/** Long enough to cover the scheduler's retry schedule (1, 5 and 15 minutes). */
const SEEN_TTL_SECONDS = 60 * 60;

/** Raw body captured by the JSON parser, needed to check the signature. */
type RequestWithRawBody = Request & { rawBody?: Buffer };

function signatureMatches(rawBody: Buffer, header: string | undefined): boolean {
  if (!header?.startsWith("sha256=") || !CONFIG.SCHEDULER_WEBHOOK_SECRET) return false;
  const expected = createHmac("sha256", CONFIG.SCHEDULER_WEBHOOK_SECRET).update(rawBody).digest();
  const actual = Buffer.from(header.slice("sha256=".length), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * The scheduler retries undelivered events, so the same event can arrive more
 * than once. Recording the id keeps a customer from being messaged twice.
 */
async function alreadyHandled(eventId: string): Promise<boolean> {
  try {
    const stored = await RedisService.getInstance()
      .getClient()
      .set(`scheduler:event:${eventId}`, "1", {
        condition: "NX",
        expiration: { type: "EX", value: SEEN_TTL_SECONDS },
      });
    return stored === null;
  } catch (error) {
    // Redis being down should not stop notifications; a rare duplicate message
    // is better than a silent one.
    logger.warn(`${TAG} Could not de-duplicate the event`, error);
    return false;
  }
}

/** Looks up the customer's number, which lives only behind the booking. */
async function phoneFor(appointmentId: string | undefined): Promise<{ phone?: string; booking?: Awaited<ReturnType<typeof SCHEDULER.getBooking>>["data"] }> {
  if (!appointmentId) return {};
  const booking = await SCHEDULER.getBooking(appointmentId);
  if (!booking.success || !booking.data) return {};
  return { phone: booking.data.customer?.phone, booking: booking.data };
}

async function handleEvent(event: SchedulerWebhookEvent): Promise<void> {
  const send = whatsappMessager.sendFreeFormTextMessage;

  // OTP events carry the number directly and must not read a booking.
  if (event.type === "CUSTOMER_OTP_REQUESTED") {
    if (!event.data.phone || !event.data.code) return;
    await send(
      event.data.phone,
      `Your Beauty Naomi verification code is *${event.data.code}*.\n\nIt expires in 10 minutes. Reply with the code to see your bookings.`,
    );
    return;
  }

  const { phone, booking } = await phoneFor(event.data.appointmentId);
  if (!phone) {
    logger.warn(`${TAG} No phone number for event ${event.id} (${event.type})`);
    return;
  }

  switch (event.type) {
    case "BOOKING_OTP_REQUESTED":
      if (event.data.code) {
        await send(
          phone,
          `Your Beauty Naomi verification code is *${event.data.code}*.\n\nIt expires in 10 minutes.`,
        );
      }
      break;

    case "BOOKING_CREATED":
      await send(
        phone,
        `*Booking confirmed!* ✨\n\n` +
          `💅 ${booking?.service?.name ?? "Your service"}\n` +
          `📅 ${longWhen(booking!.startsAt)}\n` +
          `${booking?.staff ? `👩 ${booking.staff.name}\n` : ""}` +
          `${booking?.address ? `📍 ${booking.address}\n` : ""}` +
          `🔖 ${booking!.id.slice(-6).toUpperCase()}\n\n` +
          `Reply *bookings* any time to move or cancel it.`,
      );
      break;

    case "BOOKING_RESCHEDULED":
      await send(
        phone,
        `*Your booking has moved.* 🗓️\n\n` +
          `💅 ${booking?.service?.name ?? "Your service"}\n` +
          `📅 Now: ${longWhen(event.data.newStartsAt ?? booking!.startsAt)}\n\n` +
          `See you then!`,
      );
      break;

    case "BOOKING_CANCELLED":
      await send(
        phone,
        `*Booking cancelled.*\n\n` +
          `💅 ${booking?.service?.name ?? "Your service"}\n` +
          `📅 ${longWhen(booking!.startsAt)}\n\n` +
          `We're sorry to miss you. Reply *book* whenever you'd like to come in. 💛`,
      );
      break;

    case "REMINDER_24H":
      await send(
        phone,
        `*See you tomorrow!* 💅\n\n` +
          `${booking?.service?.name ?? "Your service"} at ${longWhen(booking!.startsAt)}.\n\n` +
          `Need to change it? Reply *bookings*.`,
      );
      break;

    case "REMINDER_2H":
      await send(
        phone,
        `*Your appointment is in about 2 hours* ⏰\n\n` +
          `${booking?.service?.name ?? "Your service"} at ${longWhen(booking!.startsAt)}.\n\n` +
          `${booking?.address ? `📍 ${booking.address}\n\n` : ""}See you soon! ✨`,
      );
      break;

    case "WAITLIST_SPOT_OPEN":
      await send(
        phone,
        `*A spot just opened up!* 🎉\n\n` +
          `${longWhen(booking!.startsAt)} is now free.\n\n` +
          `Reply *book* to grab it before someone else does.`,
      );
      break;

    default:
      logger.info(`${TAG} Ignoring event type ${event.type}`);
  }
}

/**
 * Receives signed events from the scheduler and relays them to the customer on
 * WhatsApp. Always answers 200 once the signature checks out, so a failure to
 * send one message does not make the scheduler retry the whole event forever.
 */
export const schedulerWebhook = async (req: Request, res: Response): Promise<void> => {
  const rawBody = (req as RequestWithRawBody).rawBody;
  if (!rawBody || !signatureMatches(rawBody, req.get("x-scheduler-signature"))) {
    logger.warn(`${TAG} Rejected an unsigned or mis-signed request`);
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = req.body as SchedulerWebhookEvent;
  res.status(200).json({ received: true });

  try {
    if (await alreadyHandled(event.id)) {
      logger.info(`${TAG} Skipping event ${event.id}, already handled`);
      return;
    }
    await handleEvent(event);
    logger.info(`${TAG} Handled ${event.type} (${event.id})`);
  } catch (error) {
    logger.error(`${TAG} Failed to handle ${event.type} (${event.id})`, error);
  }
};

export default schedulerWebhook;
