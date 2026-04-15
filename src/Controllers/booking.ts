import { redisClient } from "../services/redis";
import { logger } from "../services/logger";
import whatsappMessager from "./Whatsapp/outgoingWhatsappMessagesHandler";
import messageComposer from "./Whatsapp/messagesComposer";
import { BookingConfirmationSections, BookingTimePartMenuSections } from "./Whatsapp/Messages/mainMenu";
import { BOOKING_STEPS } from "../constants/whatsapp";
import { getDateSelectionSections } from "./Whatsapp/Messages/mainMenu";
import UTILS from "../UTILS";

// user starts booking
export const startBooking = async (clientNumber: string) => {
  
  const existingStep = await getRedisKeyValue(clientNumber, "currentStepNumber");
  if (existingStep) {
    return; 
  }
  
  // Set initial step
  await setRedisKeyValuePair(clientNumber, "currentStepNumber", BOOKING_STEPS.bookingFullName);
  
  await whatsappMessager.sendFreeFormTextMessage(
    clientNumber,
    "*📋 Booking Form — Step 1/5*\n▰▰▱▱▱▱▱▱▱▱ 20%\n\n*👤 What is your name?*"
  );
};

export const createBookingStages = async (clientNumber: string, messageText: string) => {
  
  const currentStepNumber = await getRedisKeyValue(clientNumber, "currentStepNumber");
  
  if (!currentStepNumber) {
    return false;
  }
  
  const step = parseInt(currentStepNumber);
  
  switch(step) {
    case 1:
      await setRedisKeyValuePair(clientNumber, "bookingFullName", messageText);
      
      await setRedisKeyValuePair(clientNumber, "currentStepNumber", BOOKING_STEPS.bookingEmail);
      
      await whatsappMessager.sendFreeFormTextMessage(
        clientNumber,
        "*📋 Booking Form — Step 2/5*\n▰▰▰▰▱▱▱▱▱▱ 40%\n\n*📧 What is your email?*"
      );
       
      break;
      
    case 2:
      if (!UTILS.validateEmail(messageText)) {
    await whatsappMessager.sendFreeFormTextMessage(
      clientNumber,
      "*⚠️ That doesn't look like a valid email. Please enter a valid email address.*"
    );
    return; 
  }
      
      await setRedisKeyValuePair(clientNumber, "bookingEmail", messageText);
      
      await setRedisKeyValuePair(clientNumber, "currentStepNumber", BOOKING_STEPS.bookingPhoneNumber);
      
      await whatsappMessager.sendFreeFormTextMessage(
        clientNumber,
        "*📋 Booking Form — Step 3/5*\n▰▰▰▰▰▰▱▱▱▱ 60%\n\n*📱 What is your phone number?*"
      );
      
      break;
      case 3:
         if (!UTILS.validatePhoneNumber(messageText)) {
    await whatsappMessager.sendFreeFormTextMessage(
      clientNumber,
      "*⚠️ That doesn't look like a valid phone number. Please enter a valid phone number.*"
    );
    return; 
  }
      await setRedisKeyValuePair(clientNumber, "bookingPhoneNumber", messageText);

        await setRedisKeyValuePair(clientNumber, "currentStepNumber", BOOKING_STEPS.bookingDate);
       const dateSections = getDateSelectionSections();
        await whatsappMessager.sendInteractive(
          clientNumber,
          await  messageComposer.messageWithReplyList({
            text: "*📋 Booking Form — Step 4/5*\n▰▰▰▰▰▰▰▰▱▱ 80%\n\n*Please select your preferred appointment date:*",
            listName: "Select Date",
            sections: dateSections
          })
        )
      break;
     case 4:
      await setRedisKeyValuePair(clientNumber, "bookingDate", messageText);
       await setRedisKeyValuePair(clientNumber, "currentStepNumber", BOOKING_STEPS.bookingTime);
     const timeSlots =  BookingTimePartMenuSections;
        await whatsappMessager.sendInteractive(
          clientNumber,
          await messageComposer.messageWithReplyList({
            text: "*📋 Booking Form — Step 5/5*\n▰▰▰▰▰▰▰▰▰▰ 100%\n\n*Please select your preferred appointment time:*",
            listName: "Select Time",
            sections: timeSlots
          })
        );
      break;
    case 5:
       await setRedisKeyValuePair(clientNumber, "bookingTime", messageText);
       await setRedisKeyValuePair(clientNumber, "currentStepNumber", BOOKING_STEPS.bookingConfirmation);
      
      // Get info from redis
      const fullName = await getRedisKeyValue(clientNumber, "bookingFullName");
      const email = await getRedisKeyValue(clientNumber, "bookingEmail");
      const phone = await getRedisKeyValue(clientNumber, "bookingPhoneNumber");
      const date = await getRedisKeyValue(clientNumber, "bookingDate");
      const time = await getRedisKeyValue(clientNumber, "bookingTime");
      
      await whatsappMessager.sendInteractive(
    clientNumber,
    await messageComposer.messageWithReplyList({
      text:` 
*📋 PLEASE CONFIRM YOUR DETAILS*

*Review the information below:*

👤 *Name:* ${fullName}
📧 *Email:* ${email}
📱 *Phone:* ${phone}
📋 *Date:* ${date}
⏰ *Time:* ${time}

*Are these details correct?*`,
sections: BookingConfirmationSections,
listName: "Choose Action"
    })
  ) 
       break;
      
    default:
      return false;
  }
  
  return true;
};

export const handleBookingComplete = async (clientNumber: string, ) => {
  
  try{
    const confirmedName = await getRedisKeyValue(clientNumber, "bookingFullName");
    const confirmedEmail = await getRedisKeyValue(clientNumber, "bookingEmail");
    const confirmedPhone = await getRedisKeyValue(clientNumber, "bookingPhoneNumber");
    const confirmedTime = await getRedisKeyValue(clientNumber, "bookingTime");
    
    const bookingDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Send completion message
    const completionMessage = `
*✅ BOOKING CONFIRMED!*

━━━━━━━━━━━━━━━━━━━━━━
*BOOKING DETAILS*
━━━━━━━━━━━━━━━━━━━━━━

📅 *Date:* ${bookingDate}
👤 *Name:* ${confirmedName}
📧 *Email:* ${confirmedEmail}
📱 *Phone:* ${confirmedPhone}
⏰ *Time:* ${confirmedTime}

━━━━━━━━━━━━━━━━━━━━━━
*WHAT HAPPENS NEXT?*
━━━━━━━━━━━━━━━━━━━━━━

✅ Your booking has been received
📨 A confirmation will be sent to your email
💬 We'll contact you via WhatsApp within 24 hours

*Thank you for choosing us!* 🌟

Reply *HELP* for assistance
    `.trim();
    
    await whatsappMessager.sendFreeFormTextMessage(clientNumber, completionMessage);
    
    await setRedisKeyValuePair(clientNumber, "currentStepNumber", "6");
    
    //TO DO: save to Db
  }catch(error){
    logger.error("Error handling booking confirmation:", error);
     await whatsappMessager.sendFreeFormTextMessage(
      clientNumber,
      "*⚠️ Oops! Something went wrong while confirming your booking. Please try again.*"
    );
  }
};








export const setRedisKeyValuePair = async (
  clientNumber: string,
  key: string,
  value: string
) => {
  try {
    await redisClient.hSet(clientNumber, key, value);
    await redisClient.expire(clientNumber, 180);
    logger.silly(`${key} set to ${value} for ${clientNumber}`);
  } catch (error) {
    logger.error(`Error setting ${key} to${value}: ${error}`);
  }
};

export const deleteRedisKeyPair = async (clientNumber: string, key: string) => {
  try {
    await redisClient.hDel(clientNumber, key);
    logger.silly(`${clientNumber}:${key} deleted successfuly`);
  } catch (error) {
    logger.error(`error Deleting ${clientNumber} Key ${key}: ${error}`);
  }
};

export const getRedisKeyValue = async (clientNumber: string, key: string) => {
  try {
    const value = await redisClient.hGet(clientNumber, key);

    return value;
  } catch (error) {
    logger.error("Error fetchting stage from  Redis:", error);
  }
};