import { CONFIG } from "../../../config";
import { logger } from "../../../services/logger";
import SCHEDULER from "../../../services/scheduler.service";
import FLOW_SESSION from "../../../services/flowSession";
import whatsappMessager from "../outgoingWhatsappMessagesHandler";
import { SCREENS } from "../Flows/bookingFlow";
import type { TSchedulerCustomerBooking } from "../../../types/types";

const TAG = "[BOOKING-CONVERSATION]";

function inSalonTime(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: CONFIG.SALON_TIMEZONE, ...options }).format(
    new Date(iso),
  );
}

export function longWhen(iso: string): string {
  return inSalonTime(iso, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Opens the booking Flow. Meta never tells the Flow endpoint who it is talking
 * to, so the token is bound to this phone number up front and every screen
 * reads the customer back out of the session.
 */
export async function sendBookingFlow(clientNumber: string): Promise<void> {
  if (!CONFIG.WHATSAPP_BOOKING_FLOW_ID) {
    logger.error(`${TAG} WHATSAPP_BOOKING_FLOW_ID is not configured`);
    await whatsappMessager.sendFreeFormTextMessage(
      clientNumber,
      "Online booking is being set up right now. Please message us and we'll book you in.",
    );
    return;
  }

  const flowToken = FLOW_SESSION.newFlowToken();
  await FLOW_SESSION.createSession(flowToken, clientNumber);

  const interactive = whatsappMessager.createFlowInteractive({
    bodyText:
      "*Ready for your glow up?* 💅\n\nTap below to pick your service, choose a time that suits you, and we'll hold the slot while you confirm.",
    flowId: CONFIG.WHATSAPP_BOOKING_FLOW_ID,
    flowToken,
    flowCta: "Book appointment",
    initialScreen: SCREENS.SERVICE,
    headerText: "Beauty Naomi",
    footerText: "Takes about a minute",
  });
  // The Flow stays in draft until it is published in the Meta dashboard.
  interactive.action.parameters.mode = CONFIG.WHATSAPP_FLOW_MODE as "draft" | "published";

  await whatsappMessager.sendInteractive(clientNumber, interactive);
  logger.info(`${TAG} Sent the booking flow to ${clientNumber} with token ${flowToken}`);
}

/** Acknowledges a completed Flow, once the endpoint has already confirmed it. */
export async function acknowledgeFlowBooking(
  clientNumber: string,
  bookingId: string | undefined,
): Promise<void> {
  if (!bookingId) {
    await whatsappMessager.sendFreeFormTextMessage(
      clientNumber,
      "Thanks! We're finishing your booking and will confirm in a moment.",
    );
    return;
  }

  const booking = await SCHEDULER.getBooking(bookingId);
  if (!booking.success || !booking.data) {
    await whatsappMessager.sendFreeFormTextMessage(
      clientNumber,
      "Thanks! Your booking is being confirmed and we'll send the details shortly.",
    );
    return;
  }

  const { service, staff, startsAt, address } = booking.data;
  await whatsappMessager.sendFreeFormTextMessage(
    clientNumber,
    `*You're booked!* ✨\n\n` +
      `💅 *Service:* ${service?.name ?? "Your service"}\n` +
      `📅 *When:* ${longWhen(startsAt)}\n` +
      `${staff ? `👩 *With:* ${staff.name}\n` : ""}` +
      `${address ? `📍 *Where:* ${address}\n` : ""}` +
      `🔖 *Reference:* ${bookingId.slice(-6).toUpperCase()}\n\n` +
      `We'll remind you a day before and again two hours ahead.\n\n` +
      `Need to change it? Reply *hi* and choose *View My Bookings*.`,
  );
}

/** Renders a customer's bookings as a numbered list for the chat. */
export function bookingsSummary(bookings: TSchedulerCustomerBooking[]): string {
  return bookings
    .map((booking, index) => {
      const reference = booking.id.slice(-6).toUpperCase();
      return (
        `*${index + 1}.* ${booking.service?.name ?? "Service"}\n` +
        `   📅 ${longWhen(booking.startsAt)}\n` +
        `${booking.staff ? `   👩 ${booking.staff.name}\n` : ""}` +
        `   🔖 ${reference}`
      );
    })
    .join("\n\n");
}

const BOOKING_CONVERSATION = {
  sendBookingFlow,
  acknowledgeFlowBooking,
  bookingsSummary,
  longWhen,
};

export default BOOKING_CONVERSATION;
