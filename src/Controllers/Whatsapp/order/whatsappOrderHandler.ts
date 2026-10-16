import UTILS from "../../../UTILS";
import whatsappMessager from "../outgoingWhatsappMessagesHandler";
import { logger } from "../../../services/logger";
import { Types } from "mongoose";
import { BookingItems , WhatsAppOrderPayload} from "../../../types/types";
import { Booking} from "../../../models/Bookings";
import { CONFIG } from "../../../config";
import schedulerService from "../../../services/schedulerService";
import { createFlowContext } from "../../../services/flowContext";
import { SchedulerService } from "../../../types/scheduler";

/**
 * Interface for the response of the WhatsApp order handler
 */
export interface WhatsAppOrderHandlerResponse {
  success: boolean;
  bookingId?: string | Types.ObjectId;
  message?: string;
}

const ONE_SERVICE_AT_A_TIME_TEXT =
  "Please book *one service at a time* 💖\n\nOpen the catalog again and send an order with just the service you'd like to book.";

const UNKNOWN_SERVICE_TEXT =
  "Sorry, we couldn't find that service in our booking system 😔\n\nPlease try another service or reply *hi* to start again.";

/** e.g. "60 min · USD 15.00" (price omitted when it is zero). */
export const describeService = (service: SchedulerService) => {
  const price = service.priceCents > 0 ? ` · ${service.currency} ${(service.priceCents / 100).toFixed(2)}` : "";
  return `${service.baseDurationMinutes} min${price}`;
};

/**
 * Processes a WhatsApp catalog order: maps the product to a scheduler service, records a pending
 * booking and sends the booking Flow so the customer can pick a date and time.
 * @param from - The WhatsApp contact number of the user placing the order
 * @param orderPayload - The payload containing the order details from WhatsApp
 * @param profileName - The customer's WhatsApp profile name, used to pre-fill the Flow
 * @returns A promise that resolves to a WhatsAppOrderHandlerResponse indicating the success or failure of the operation
 */
export const processWhatsAppOrder = async (
  from: string,
  orderPayload: WhatsAppOrderPayload,
  profileName?: string,
): Promise <WhatsAppOrderHandlerResponse> => {
  try {
    const retailerIds = [...new Set(orderPayload.product_items.map((item) => item.product_retailer_id))];
    if (retailerIds.length !== 1) {
      await whatsappMessager.sendFreeFormTextMessage(from, ONE_SERVICE_AT_A_TIME_TEXT);
      return { success: false, message: "Order contains more than one service" };
    }

    const retailerId = retailerIds[0]!;
    const service = await schedulerService.findServiceByRetailerId(retailerId);
    if (!service) {
      logger.warn(`No scheduler service is mapped to catalog retailer ID ${retailerId}`);
      await whatsappMessager.sendFreeFormTextMessage(from, UNKNOWN_SERVICE_TEXT);
      return { success: false, message: `Unknown catalog retailer ID ${retailerId}` };
    }

    const nextBookingId = await UTILS.getNextAutoIncrementNumber("bookings");// bookings is just a placeholder
    const bookingId = `BN-${nextBookingId}`;
    logger.info(`Creating appointment ${bookingId} for contact ${from}`);

    const bookingItems: BookingItems[] = [];
    let totalAmount = 0;
    for (const item of orderPayload.product_items) {
      const price = item.item_price || 0;
      const quantity = item.quantity || 1;
      logger.info(`This is the item`, item);
       bookingItems.push({
        productName: service.name,
        quantity: 1,
  priceAtOrder: price,
  productRetailerId: item.product_retailer_id,
  unitPrice: price,
  subtotal:price * quantity,
      });
      totalAmount += price;
    }

    const newBooking = {
      bookingId,
      contact: from,
      items: bookingItems,
      totalAmount,
      serviceName: service.name,
      schedulerServiceId: service.id,
      status: "PENDING_SLOT",
      bookingDate: null,
      bookingTime: "",
      notes: orderPayload.text || "Order received via WhatsApp",
    };

    const booking = new Booking(newBooking);
    await booking.save();

    const flowToken = await createFlowContext({
      phone: from,
      serviceId: service.id,
      serviceName: service.name,
      serviceDetails: describeService(service),
      bookingId,
      customerName: profileName,
    });

    logger.info(`Order processed for ${from} with booking ID ${bookingId}`);
    await whatsappMessager.sendFreeFormTextMessage(
      from,
       messageWithOrderSummary( bookingId, [service.name], totalAmount )
      );
    await whatsappMessager.sendInteractive(
      from,
      whatsappMessager.createFlowInteractive({
        bodyText: `Choose a date and time for your *${service.name}* appointment ✨`,
        flowId: CONFIG.WHATSAPP_BOOKING_FLOW_ID,
        flowToken,
        flowCta: "Pick a time",
        initialScreen: "BOOK",
        flowAction: "data_exchange",
        footerText: "Powered by Beauty Naomi",
      }),
    );

    return {
      success: true,
      bookingId: newBooking.bookingId,
      message: `Order ${newBooking.bookingId} created successfully`,
    };
  } catch (error) {
    logger.error("Error processing WhatsApp order:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error processing order",
    };
  }
};

const messageWithOrderSummary = (
  bookingId: string,
  items: string[],
  totalAmount: number,
) => {
  const itemsList = items.map((item) => `• ${item}`).join("\n");

  return `*Order Details!* 🛍️

---
*Order Summary (#${bookingId}):*
${itemsList}

*Total:* ${totalAmount}
---

✅ *What happens next?*
Tap *Pick a time* below to choose your date and time.

💬 *Need help?*
If you have any questions or need to change your details, just reply to this message with *help*.

Thank you for choosing *Beauty Naomi*! ✨`;
};
