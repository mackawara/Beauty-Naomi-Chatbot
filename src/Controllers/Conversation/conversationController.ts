import { logger } from "../../services/logger";
import {
  MAIN_MENU_REPLY_ID,
  MANAGE_REPLY_PREFIX,
  TEXT_COMMANDS_ID,
} from "../../constants/whatsapp";
import messageComposer from "../Whatsapp/messagesComposer";
import WhatsappMessages from "../Whatsapp/Messages";
import whatsappMessager from "../Whatsapp/outgoingWhatsappMessagesHandler";
import { InteractivePayLoad, Nfm_Reply } from "../../types/types";
import { MainMenuSections } from "../Whatsapp/Messages/mainMenu";
import BOOKING_CONVERSATION from "../Whatsapp/booking/bookingConversation";
import MANAGE_BOOKING from "../Whatsapp/booking/manageBooking";

const sendMainMenu = async (clientNumber: string) => {
  await whatsappMessager.sendInteractive(
    clientNumber,
    messageComposer.messageWithReplyList({
      text: WhatsappMessages.TextMessages.initialMessageText,
      sections: MainMenuSections,
      listName: "Main Menu",
    }),
  );
};

const buttonReplyHandler = async (clientNumber: string, replyId: string) => {
  const TAG = "[REPLY-BUTTON-MESSAGE]";
  try {
    logger.info(`${TAG} Received a button reply message`, replyId);
    switch (replyId) {
      case MANAGE_REPLY_PREFIX.confirmCancel:
        await MANAGE_BOOKING.confirmCancel(clientNumber);
        break;
      case MANAGE_REPLY_PREFIX.keepBooking:
        await MANAGE_BOOKING.keepBooking(clientNumber);
        break;
      default:
        break;
    }
  } catch (error) {
    logger.error("Error on button reply handler", error);
  }
  return;
};

const listReplyHandler = async (clientNumber: string, replyId: string) => {
  const TAG = "[REPLY-LIST-MESSAGE]";
  logger.info(`${TAG} Received a list reply message`, replyId);
  try {
    // Rows that act on one booking carry its id, so they are matched by prefix
    // before the fixed menu entries.
    if (replyId.startsWith(MANAGE_REPLY_PREFIX.cancel)) {
      await MANAGE_BOOKING.startCancel(clientNumber, replyId.slice(MANAGE_REPLY_PREFIX.cancel.length));
      return;
    }
    if (replyId.startsWith(MANAGE_REPLY_PREFIX.reschedule)) {
      await MANAGE_BOOKING.startReschedule(clientNumber, replyId.slice(MANAGE_REPLY_PREFIX.reschedule.length));
      return;
    }
    if (replyId.startsWith(MANAGE_REPLY_PREFIX.date)) {
      await MANAGE_BOOKING.pickRescheduleDate(clientNumber, replyId.slice(MANAGE_REPLY_PREFIX.date.length));
      return;
    }
    if (replyId.startsWith(MANAGE_REPLY_PREFIX.time)) {
      await MANAGE_BOOKING.pickRescheduleTime(clientNumber, replyId.slice(MANAGE_REPLY_PREFIX.time.length));
      return;
    }

    switch (replyId) {
      case MAIN_MENU_REPLY_ID.book_appointment:
        await BOOKING_CONVERSATION.sendBookingFlow(clientNumber);
        break;
      case MAIN_MENU_REPLY_ID.view_my_bookings:
        await MANAGE_BOOKING.startManageBookings(clientNumber);
        break;
      default:
        break;
    }
  } catch (error) {
    logger.error("Error on list reply handler", error);
    throw error;
  }
};

/** The Flow's terminal screen returns here once the booking is confirmed. */
const flowReplyHandler = async (clientNumber: string, nfmReply: Nfm_Reply) => {
  const TAG = "[FLOW-REPLY]";
  try {
    const response = JSON.parse(nfmReply.response_json) as {
      booking_id?: string;
      status?: string;
    };
    logger.info(`${TAG} Flow completed for ${clientNumber}`, { status: response.status });
    await BOOKING_CONVERSATION.acknowledgeFlowBooking(clientNumber, response.booking_id);
  } catch (error) {
    logger.error(`${TAG} Could not read the flow response`, error);
    await whatsappMessager.sendFreeFormTextMessage(
      clientNumber,
      "Thanks! We're checking your booking and will confirm shortly.",
    );
  }
};

const textReplyHandler = async (clientNumber: string, text: string) => {
  const TAG = "[TEXT MESSAGE]";
  logger.info(`${TAG} Received Text Reply Message`);
  try {
    const trimmed = text.trim();

    // A six-digit reply is almost certainly the verification code, so it is
    // matched before the menu commands.
    if (/^\d{6}$/.test(trimmed) && (await MANAGE_BOOKING.handleOtpReply(clientNumber, trimmed))) {
      return;
    }

    switch (trimmed.toLowerCase()) {
      case TEXT_COMMANDS_ID.hi:
      case TEXT_COMMANDS_ID.menu:
        await sendMainMenu(clientNumber);
        break;
      case TEXT_COMMANDS_ID.book:
        await BOOKING_CONVERSATION.sendBookingFlow(clientNumber);
        break;
      case TEXT_COMMANDS_ID.bookings:
        await MANAGE_BOOKING.startManageBookings(clientNumber);
        break;
      case TEXT_COMMANDS_ID.help:
        await whatsappMessager.sendFreeFormTextMessage(
          clientNumber,
          "*How can we help?* 💛\n\n" +
            "• *book* — book an appointment\n" +
            "• *bookings* — see, move or cancel your appointments\n" +
            "• *menu* — the main menu\n\n" +
            "Or just send us a message and we'll get back to you.",
        );
        break;
      default:
        break;
    }

    return;
  } catch (error) {
    logger.error(`${TAG} Error on text reply message `, error);
    throw error;
  }
};

const interactiveReplyHandler = async (
  clientNumber: string,
  interactive: InteractivePayLoad,
) => {
  const interactiveType = interactive.type;
  const TAG = "[INTERACTIVE MESSAGE]";
  try {
    logger.info(`${TAG} Received interactive Reply Message`);
    switch (interactiveType) {
      case "button_reply":
        {
          await buttonReplyHandler(clientNumber, interactive.button_reply.id);
        }
        break;
      case "list_reply": {
        const listReply = interactive.list_reply.id;
        logger.info(`list reply message with ID ${listReply}`);
        await listReplyHandler(clientNumber, listReply);
        break;
      }
      case "nfm_reply": {
        await flowReplyHandler(clientNumber, interactive.nfm_reply);
        break;
      }
      default:
        break;
    }

    return;
  } catch (error) {
    logger.error(
      `${TAG} Error on interactive reply message `,
      error,
    );
    throw error;
  }
};

const CONVERSATION_CONTROLLER = {
  buttonReplyHandler,
  listReplyHandler,
  interactiveReplyHandler,
  textReplyHandler,
  flowReplyHandler,
};

export default CONVERSATION_CONTROLLER;
