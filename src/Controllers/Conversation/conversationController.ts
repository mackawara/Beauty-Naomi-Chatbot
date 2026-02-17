import { logger } from "../../services/logger";
import {
  MAIN_MENU_REPLY_ID,
  VIEW_BOOKING_MENU_REPLY_ID,
  TEXT_COMMANDS_ID,
} from "../../constants/whatsapp";
import messageComposer from "../Whatsapp/messagesComposer";
import WhatsappMessages from "../Whatsapp/Messages";
import whatsappMessager from "../Whatsapp/outgoingWhatsappMessagesHandler";
import { InteractivePayLoad } from "../../types/types";
import { MainMenuSections } from "../Whatsapp/Messages/mainMenu";

const buttonReplyHandler = async (clientNumber: string, replyId: string) => {
  const TAG = "[REPLY-BUTTON-MESSAGE]"
  try {
    logger.info( `${TAG} Received a button reply message`);
  } catch (error) {
    logger.error("Error on button reply handler", error);
  }
  return;
};

const listReplyHandler = async (clientNumber: string, replyId: string) => {
  const TAG = "[REPLY-LIST-MESSAGE]"
  logger.info(`${TAG} Received a list reply message`, replyId);
  try {
    switch (replyId) {
      case MAIN_MENU_REPLY_ID.view_my_bookings:
        {
          await whatsappMessager.sendInteractive(
            clientNumber,
            messageComposer.messageWithReplyList({
              text: WhatsappMessages.TextMessages.viewMyBookingsText,

              sections: WhatsappMessages.ViewBookingMenuSections,
              listName: "Manage Booking",
            }),
          );
        }
        break;
      case MAIN_MENU_REPLY_ID.book_appointment:
        {
          logger.info("The book aapointents button was clicked");
        }
        break;
      case VIEW_BOOKING_MENU_REPLY_ID.cancel:
        {
          logger.info("The cancel button was clicked");
        }
        break;
      case VIEW_BOOKING_MENU_REPLY_ID.reschedule:
        logger.info("The reschedule button was clicked");
        break;
      default:
        break;
    }
  } catch (error) {
    logger.error("Error on list reply handler", error);
    throw error;
  }
};

const textReplyHandler = async (clientNumber: string, text: string) => {
  const TAG = "[TEXT MESSAGE]"
  logger.info(`${TAG} Received Text Reply Message`);
  try {
    switch (text.toLowerCase()) {
      case TEXT_COMMANDS_ID.hi:
        {
          await whatsappMessager.sendInteractive(
            clientNumber,
            messageComposer.messageWithReplyList({
              text: WhatsappMessages.TextMessages.initialMessageText,
              sections: MainMenuSections,
              listName: "Main Menu",
            }),
          );
        }
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
  const TAG = "[INTERACTIVE MESSAGE]"
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
};

export default CONVERSATION_CONTROLLER;
