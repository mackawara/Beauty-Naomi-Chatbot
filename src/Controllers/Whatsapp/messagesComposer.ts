import { logger } from "../../services/logger";
import whatsappMessager from "./outgoingWhatsappMessagesHandler";
import { InteractiveList } from "../../types/types";
import { MainMenuSections } from "./Messages/mainMenu";
import {
  InteractiveActionSection,
  Interactive,
  ReplyButtonObject,
  TextObject,
} from "../../types/types";

interface ReplyList {
  text: string;
  sections: InteractiveActionSection[];
  listName: string;
}

const messageWithReplyList = (listObject: ReplyList): InteractiveList => {
  const message: InteractiveList = {
    type: "list",
    body: {
      text: listObject.text,
    },
    action: {
      sections: listObject.sections,
      button: listObject.listName,
    },
  };
  return message;
};

interface ReplyButtons {
  text: string;
  buttons: ReplyButtonObject[];
}

const messageWithReplyButtons = (buttonsObject: ReplyButtons): Interactive => {
  const message: Interactive = {
    type: "button",
    body: {
      text: buttonsObject.text,
    },
    action: {
      buttons: buttonsObject.buttons,
    },
  };
  return message;
};

const messageComposer = {
  messageWithReplyList,
  messageWithReplyButtons,
};

export default messageComposer;
