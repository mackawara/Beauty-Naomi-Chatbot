import { logger } from '../../services/logger'
import whatsappMessager from './outgoingWhatsappMessagesHandler';
import { InteractiveList } from '../../types/types';
import { MainMenuSections } from './Messages/mainMenu';
import { InteractiveActionSection } from '../../types/types';

interface ReplyList {
  text: string;
  sections : InteractiveActionSection[];
  listName: string;
}

const messageWithReplyList = (listObject: ReplyList): InteractiveList=>{
     const message: InteractiveList = {
              type: 'list',
              body: {
                  text: listObject.text,
                 },
              action: {
                  sections: listObject.sections,
                  button: listObject.listName
              },
          };

      return message
}

 

const messageComposer ={
     messageWithReplyList
   
}

export default messageComposer