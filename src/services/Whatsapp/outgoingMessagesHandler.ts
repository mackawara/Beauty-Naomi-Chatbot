import { logger } from '../logger'
import whatsappMessager from './messagesController';
import { InteractiveList } from '../../types/types';
import { sections } from '../../Conversation/messageComposer.controller';
import { cli } from 'winston/lib/winston/config';


 const freeformext = async(receivingNumber: string,) =>{
    logger.info(`[OUTGOING_MESSAGES_HANDLER] Sending message to ${receivingNumber}`);
 
    whatsappMessager.sendFreeFormTextMessage(
        receivingNumber,
        `Hello! \nThis is a message from Beauty Naomi Chatbot. \n\nHow can we assist you today? Please choose one of the following options by replying with the corresponding number:\n\n\n*1.Book an Appointment*\n\n*2.Inquire about our services*\n\n*3.Reschedule an Appointment*
        `
    )

}

const welcomeMessageForm = (clientNumber: string)=>{
     const welcomeMessage: InteractiveList = {
              type: 'list',
              body: {
                  text:`Hi, ${clientNumber || "😃"} 👋\n\n*Welcome to Beauty Naomi Chatbot*\n\nPlease click on any of the buttons below to proceed. To restart anytime, simply send "hi". `
                },
              action: {
                  sections,
                  button: 'Main Menu'
              },
          };

          whatsappMessager.sendInteractive(
            clientNumber,
            welcomeMessage
          )
}

const outgoingMessagesHandler ={
    welcomeMessageForm,
    freeformext
}

export default outgoingMessagesHandler