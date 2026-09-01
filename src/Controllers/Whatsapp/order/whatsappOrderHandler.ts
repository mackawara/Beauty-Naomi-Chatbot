import UTILS from "../../../UTILS";
import whatsappMessager from "../outgoingWhatsappMessagesHandler";
import { logger } from "../../../services/logger";
import { Types } from "mongoose";
import { BookingItems , WhatsAppOrderPayload} from "../../../types/types";
import { Booking} from "../../../models/Bookings";
import { serviceHandler, itemDescriptions } from "../../services";
import { extractAndConvertToMinutes } from "../../services";

/**
 * Interface for the response of the WhatsApp order handler
 */
export interface WhatsAppOrderHandlerResponse {
  success: boolean;
  bookingId?: string | Types.ObjectId;
  message?: string;
}

/**
 * Processes a WhatsApp order by creating a booking and sending a confirmation message to the user.
 * @param from - The WhatsApp contact number of the user placing the order
 * @param orderPayload - The payload containing the order details from WhatsApp
 * @returns A promise that resolves to a WhatsAppOrderHandlerResponse indicating the success or failure of the operation
 */
export const processWhatsAppOrder = async (
  from: string,
  orderPayload: WhatsAppOrderPayload,
): Promise <WhatsAppOrderHandlerResponse> => {
  try {
    const nextBookingId = await UTILS.getNextAutoIncrementNumber("bookings");// bookings is just a placeholder
    const bookingId = `BN-${nextBookingId}`;
    logger.info(`Creating appointment ${bookingId} for contact ${from}`);

    let bookingItems: BookingItems[] = []; 
    let totalAmount = 0;
    let itemNames = [];
    for (const item of orderPayload.product_items) {
      const price = item.item_price || 0;
      const quantity = item.quantity || 1;
      const productName = `${item.product_retailer_id}`;
      itemNames.push(productName);
      logger.info(`This is the item`, item);
       bookingItems.push({
        productName: productName,
        quantity: 1,
  priceAtOrder: price,
  productRetailerId: item.product_retailer_id,
  unitPrice: price,
  subtotal:price * quantity,
      });
      totalAmount += price;

      // saving services
      const itemDescription = (itemDescriptions as Record<string, string>)[productName];
      const serviceDuration = extractAndConvertToMinutes(itemDescription);
      if (serviceDuration === null) {
        logger.warn(`Could not extract service duration from description: ${itemDescription}`);
      } else {
        logger.info(`Extracted service duration: ${serviceDuration} minutes`);
      }
      logger.info(`Creating service for product ${productName} with duration ${serviceDuration} minutes from ${itemDescription}`);
      await serviceHandler({
        serviceName: productName,
        productRetailerId: item.product_retailer_id,
        catalogId: orderPayload.catalog_id,
        duration: serviceDuration ?? 30,
        eventTypeId: ""
      })
      logger.info(`Service created successfully for ${productName}:`);
   
     
    }

    const newBooking = {
      bookingId,
      contact: from,
      items: bookingItems,
      totalAmount,
      serviceName: orderPayload.product_items
        .map((item) => item.product_retailer_id)
        .join(", "),
      bookingDate: "",
      appointmentTime: "",
      notes: orderPayload.text || "Order received via WhatsApp",
    };

    const booking = new Booking(newBooking);
    await booking.save();

    logger.info(`Order processed for ${from} with booking ID ${bookingId}`);
    await whatsappMessager.sendFreeFormTextMessage(
      from,
      messageWithOrderSummary(bookingId, itemNames, totalAmount)
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
We’re sending over a form for you to complete. Please double check that all the details are correct before submitting`

};






