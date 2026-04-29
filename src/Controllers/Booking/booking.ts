import { redisClient } from "../../services/redis";
import {
  setRedisKeyValuePair,
  getRedisKeyValue,
} from "../Conversation/redisController";
import { logger } from "../../services/logger";
import whatsappMessager from "../Whatsapp/outgoingWhatsappMessagesHandler";
import messageComposer from "../Whatsapp/messagesComposer";
import { BOOKING_STAGES } from "../../constants/whatsapp";
import { BookingConfirmationSections } from "../messageTemplatesRows";
import validator from "validator";
import { bookingMessages } from "../../constants/bookingMessages";

export const bookingStageHandler = async (
  clientNumber: string,
  messageText: string,
) => {
  const currentStage = await getRedisKeyValue(clientNumber, "currentStage");

  if (!currentStage) {
    return;
  }

  const stage = currentStage;

  switch (stage) {
    case BOOKING_STAGES.bookingFullName:
      await setRedisKeyValuePair(clientNumber, "bookingFullName", messageText);

      await setRedisKeyValuePair(
        clientNumber,
        "currentStage",
        BOOKING_STAGES.bookingEmail,
      );

      await whatsappMessager.sendFreeFormTextMessage(
        clientNumber,
        bookingMessages.bookingStagesMsgs.bookingEmailMsg,
      );

      break;

    case BOOKING_STAGES.bookingEmail:
      if (!validator.isEmail(messageText)) {
        await whatsappMessager.sendFreeFormTextMessage(
          clientNumber,
          bookingMessages.validationMsgs.invalidEmailMsg,
        );
        return;
      }

      await setRedisKeyValuePair(clientNumber, "bookingEmail", messageText);

      await setRedisKeyValuePair(
        clientNumber,
        "currentStage",
        BOOKING_STAGES.bookingPhoneNumber,
      );

      await whatsappMessager.sendFreeFormTextMessage(
        clientNumber,
        bookingMessages.bookingStagesMsgs.bookingPhoneNumberMsg,
      );

      break;
    case BOOKING_STAGES.bookingPhoneNumber:
      if (!validator.isMobilePhone(messageText, "any")) {
        await whatsappMessager.sendFreeFormTextMessage(
          clientNumber,
          bookingMessages.validationMsgs.invalidPhoneMsg,
        );
        return;
      }
      await setRedisKeyValuePair(
        clientNumber,
        "bookingPhoneNumber",
        messageText,
      );

      await setRedisKeyValuePair(
        clientNumber,
        "currentStage",
        BOOKING_STAGES.bookingDate,
      );
      await whatsappMessager.sendFreeFormTextMessage(
        clientNumber,
        bookingMessages.bookingStagesMsgs.bookingDateMsg,
      );
      break;
    case BOOKING_STAGES.bookingDate:
      await setRedisKeyValuePair(clientNumber, "bookingDate", messageText);
      await setRedisKeyValuePair(
        clientNumber,
        "currentStage",
        BOOKING_STAGES.bookingTime,
      );
      await whatsappMessager.sendFreeFormTextMessage(
        clientNumber,
        bookingMessages.bookingStagesMsgs.bookingTimeMsg,
      );
      break;
    case BOOKING_STAGES.bookingTime:
      await setRedisKeyValuePair(clientNumber, "bookingTime", messageText);
      await setRedisKeyValuePair(
        clientNumber,
        "currentStage",
        BOOKING_STAGES.bookingConfirmation,
      );

      // Get info from redis
      const bookingDetails = await redisClient.hGetAll(clientNumber);
      logger.info(`Booking details for ${clientNumber}:`, bookingDetails);

      const {
        bookingFullName,
        bookingEmail,
        bookingPhoneNumber,
        bookingDate,
        bookingTime,
      } = bookingDetails;

      await whatsappMessager.sendInteractive(
        clientNumber,
        await messageComposer.messageWithReplyList({
          text: ` 
*📋 PLEASE CONFIRM YOUR DETAILS*

*Review the information below:*

👤 *Name:* ${bookingFullName}
📧 *Email:* ${bookingEmail}
📱 *Phone:* ${bookingPhoneNumber}
📋 *Date:* ${bookingDate}
⏰ *Time:* ${bookingTime}

*Are these details correct?*`,
          sections: BookingConfirmationSections,
          listName: "Choose Action",
        }),
      );
      break;

    default:
      return;
  }

  return;
};

export const sendBookingConfirmation = async (clientNumber: string) => {
  await setRedisKeyValuePair(
    clientNumber,
    "currentStage",
    BOOKING_STAGES.bookingConfirmation,
  );
  try {
    const confirmedDetails = await redisClient.hGetAll(clientNumber);
    logger.info(
      `Confirmed booking details for ${clientNumber}:`,
      confirmedDetails,
    );

    const {
      bookingFullName,
      bookingEmail,
      bookingPhoneNumber,
      bookingDate,
      bookingTime,
    } = confirmedDetails;

    // Send completion message
    const completionMessage = `
*✅ BOOKING CONFIRMED!*

━━━━━━━━━━━━━━━━━━━━━━
*BOOKING DETAILS*
━━━━━━━━━━━━━━━━━━━━━━

📅 *Date:* ${bookingDate}
👤 *Name:* ${bookingFullName}
📧 *Email:* ${bookingEmail}
📱 *Phone:* ${bookingPhoneNumber}
⏰ *Time:* ${bookingTime}

━━━━━━━━━━━━━━━━━━━━━━
*WHAT HAPPENS NEXT?*
━━━━━━━━━━━━━━━━━━━━━━

✅ Your booking has been received
📨 A confirmation will be sent to your email
💬 We'll contact you via WhatsApp within 24 hours

*Thank you for choosing us!* 🌟

Reply *HELP* for assistance
    `.trim();

    await whatsappMessager.sendFreeFormTextMessage(
      clientNumber,
      completionMessage,
    );

    //TO DO: save to Db
  } catch (error) {
    logger.error("Error handling booking confirmation:", error);
    await whatsappMessager.sendFreeFormTextMessage(
      clientNumber,
      bookingMessages.bookingStagesMsgs.confirmationErrorMsg,
    );
  }
};
