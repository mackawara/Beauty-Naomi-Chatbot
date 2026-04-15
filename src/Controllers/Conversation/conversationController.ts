import { logger } from "../../services/logger";
import {
  MAIN_MENU_REPLY_ID,
  VIEW_BOOKING_MENU_REPLY_ID,
  TEXT_COMMANDS_ID,
  BOOKING_ID,
  BOOKING_STEPS,
} from "../../constants/whatsapp";
import messageComposer from "../Whatsapp/messagesComposer";
import WhatsappMessages from "../Whatsapp/Messages";
import whatsappMessager from "../Whatsapp/outgoingWhatsappMessagesHandler";
import { InteractivePayLoad } from "../../types/types";
import { getDateRows, MainMenuSections, getMorningTimeSlotsSections, getAfternoonTimeSlotsSections } from "../Whatsapp/Messages/mainMenu";
import { createBookingStages, handleBookingComplete} from "../booking";
import { setRedisKeyValuePair, getRedisKeyValue } from "../booking";

const buttonReplyHandler = async (clientNumber: string, replyId: string) => {
  const TAG = "[REPLY-BUTTON-MESSAGE]"
  try {
    logger.info( `${TAG} Received a button reply message`);
  } catch (error) {
    logger.error("Error on button reply handler", error);
  }
  return;
};

const getDateId = (selectedDateId: string) => {
  const selectedRow = getDateRows().find(row => row.id === selectedDateId);
  return selectedRow?.id;
};

const getSlotId = async (clientNumber: string, selectedSlotId: string) => {
  const timeSlotsJson = await getRedisKeyValue(clientNumber, "availableTimeSlots");
  const timeSlotsData = timeSlotsJson ? JSON.parse(timeSlotsJson) : [];

const slotId = selectedSlotId.split("_").pop();
const slot = timeSlotsData.find((time: string) => time === slotId);
return slot;
}


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
          await whatsappMessager.sendWhatsAppCatalogMessage({
            phone: clientNumber,
            bodyText: WhatsappMessages.TextMessages.catalogMessageText
          })
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
        case BOOKING_ID.fixDetails:
        logger.info("The fix details button was clicked");
        await setRedisKeyValuePair(clientNumber, "currentStepNumber", "1");
         await whatsappMessager.sendFreeFormTextMessage(
              clientNumber,
              "*✏️ Let's update your details...*\n\n*📋 Booking Form — Step 1/4*\n▰▱▱▱▱▱▱▱▱▱ 20%\n\n*👤 What is your full name?*"
            );
        break;
        case BOOKING_ID.confirm:
          logger.info("The confirm button was clicked");
         await handleBookingComplete(clientNumber)
         break;
         case BOOKING_ID.earlyMorningSlots:
          logger.info("The morning slots button was clicked");
          const morningSections = await getMorningTimeSlotsSections(clientNumber);
          await whatsappMessager.sendInteractive(
            clientNumber,
            messageComposer.messageWithReplyList({  
              text: "Here are the available morning time slots:",
              sections: morningSections,
              listName: "Morning Time Slots",
            }),
          );
          break;
          case BOOKING_ID.afternoonSlots:
            logger.info("The afternoon slots button was clicked");
            const afternoonSections = await getAfternoonTimeSlotsSections(clientNumber);
            await whatsappMessager.sendInteractive(
              clientNumber,
              messageComposer.messageWithReplyList({
                text: "Here are the available afternoon time slots:",
                sections: afternoonSections,
                listName: "Afternoon Time Slots",
              }),
            );
            break;
      default: {
        const bookingDateId = getDateId(replyId);
        if (bookingDateId) {
          logger.info("The date was selected");
          //get booking id
          //get event type id 
          //format date
          await setRedisKeyValuePair(clientNumber, "currentStepNumber", BOOKING_STEPS.bookingDate);
          await createBookingStages(clientNumber, bookingDateId);
          break;
        }

        const slotId = await getSlotId(clientNumber, replyId);
        if (slotId) {
          logger.info("The time slot was selected");
          await setRedisKeyValuePair(clientNumber, "currentStepNumber", BOOKING_STEPS.bookingTime);
          await createBookingStages(clientNumber, slotId);
          break;
        }

        logger.warn("Received an unrecognized list reply ID: ", replyId);
        break;
      }
    }
  } catch (error) {
    logger.error("Error on list reply handler", error);
    throw error;
  }
};

export const textReplyHandler = async (clientNumber: string, text: string) => {
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
        
        await createBookingStages(clientNumber, text);
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
