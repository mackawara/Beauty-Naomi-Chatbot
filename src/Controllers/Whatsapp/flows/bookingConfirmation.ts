import { logger } from "../../../services/logger";
import schedulerService from "../../../services/schedulerService";
import { Booking } from "../../../models/Bookings";
import { releaseFlowContext } from "../../../services/flowContext";
import whatsappMessager from "../outgoingWhatsappMessagesHandler";
import { ConfirmedBooking, formatDay, formatTime } from "./bookingFlow";

const TAG = "[BOOKING-CONFIRMATION]";

export const bookingConfirmedText = (input: {
  serviceName: string;
  day: string;
  time: string;
  address: string | null;
  reference: string;
}) =>
  "*You're booked!* 💅\n\n" +
  "━━━━━━━━━━━━━━━━━━━\n" +
  `✨ *Service:* ${input.serviceName}\n` +
  `📅 *Date:* ${input.day}\n` +
  `🕒 *Time:* ${input.time}\n` +
  (input.address ? `📍 *Where:* ${input.address}\n` : "") +
  `🔖 *Ref:* ${input.reference}\n` +
  "━━━━━━━━━━━━━━━━━━━\n\n" +
  "We'll remind you before your appointment. See you soon! 💖";

/**
 * Runs after the scheduler confirms a booking made in the Flow: marks the local booking CONFIRMED,
 * sends one WhatsApp confirmation and returns the SUCCESS screen summary.
 * Replays (double taps, Flow retries) find the booking already CONFIRMED and send nothing.
 */
export const handleConfirmedBooking = async ({ context, flowToken, booking, customerName }: ConfirmedBooking) => {
  const details = await schedulerService.getBooking(booking.id).catch((error) => {
    logger.warn(`${TAG} Could not load booking ${booking.id}`, error?.code ?? error);
    return null;
  });
  const localStart = details?.localStart ?? booking.startsAt;
  const day = formatDay(localStart.slice(0, 10));
  const time = formatTime(localStart);

  const updated = await Booking.findOneAndUpdate(
    { bookingId: context.bookingId, status: { $ne: "CONFIRMED" } },
    {
      $set: {
        status: "CONFIRMED",
        schedulerAppointmentId: booking.id,
        bookingDate: new Date(booking.startsAt),
        bookingTime: time,
        ...(customerName ? { notes: `Booked by ${customerName} via WhatsApp Flow` } : {}),
      },
    },
    { new: true },
  );

  if (updated) {
    await releaseFlowContext(flowToken).catch(() => undefined);
    // Don't hold up the Flow response on the WhatsApp API.
    whatsappMessager
      .sendFreeFormTextMessage(
        context.phone,
        bookingConfirmedText({
          serviceName: context.serviceName,
          day,
          time,
          address: details?.address ?? null,
          reference: context.bookingId,
        }),
      )
      .catch((error) => logger.error(`${TAG} Could not send confirmation for ${context.bookingId}`, error));
    logger.info(`${TAG} Booking ${context.bookingId} confirmed as appointment ${booking.id}`);
  } else {
    logger.info(`${TAG} Booking ${context.bookingId} was already confirmed; not notifying again`);
  }

  return [context.serviceName, `${day} at ${time}`, `Ref ${context.bookingId}`].join("\n");
};
