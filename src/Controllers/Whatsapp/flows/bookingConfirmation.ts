import { logger } from "../../../services/logger";
import schedulerService from "../../../services/schedulerService";
import { ConfirmedBooking, formatDay, formatTime } from "./bookingFlow";

const TAG = "[BOOKING-CONFIRMATION]";

/** Runs after the scheduler confirms a booking made in the Flow; returns the SUCCESS screen summary. */
export const handleConfirmedBooking = async ({ context, booking }: ConfirmedBooking): Promise<string> => {
  const details = await schedulerService.getBooking(booking.id).catch((error) => {
    logger.warn(`${TAG} Could not load booking ${booking.id}`, error?.code ?? error);
    return null;
  });
  const when = details ? `${formatDay(details.localStart.slice(0, 10))} at ${formatTime(details.localStart)}` : "";
  return [context.serviceName, when, `Ref ${context.bookingId}`].filter(Boolean).join("\n");
};
