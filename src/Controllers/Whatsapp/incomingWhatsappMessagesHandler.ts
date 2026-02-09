import express, { Request, Response } from "express";
import { logger } from "../../services/logger";
import { CONFIG } from "../../config";
import messageComposer from "./messagesComposer";
import { WebhookNotificationBody } from "../../types/types";
import whatsappMessager from "./outgoingWhatsappMessagesHandler";
import { MainMenuSections } from "./Messages/mainMenu";
import CONVERSATION_CONTROLLER from "../Conversation/conversationController";

export const incomingMessages = async (req: Request, res: Response) => {
  const reqBody: WebhookNotificationBody = req.body;

  if (reqBody.object) {
    const { messages } = reqBody.entry[0].changes[0].value;
    if (messages) {
      const notificationType = messages[0].type;
      const from = messages[0].from;
      const clientNumber = from;

      switch (notificationType) {
        case "text":
          {
            await CONVERSATION_CONTROLLER.textReplyHandler();
            await whatsappMessager.sendInteractive(
              clientNumber,
              messageComposer.messageWithReplyList({
                text: "Hi  \nWe are the Beauty Naomi Chatbot \nHelloooooo \n\n",
                sections: MainMenuSections,
                listName: "Main Menu",
              }),
            );
          }
          break;
        case "interactive":
          {
            await CONVERSATION_CONTROLLER.interactiveReplyHandler();
          }
          break;
        case "order":
          {
            logger.info("[ORDER MESSAGE]: Received Order Message");
          }
          break;
        case "reaction":
          {
            logger.info("[REACTION MESSAGE]: Received a reaction Message");
          }
          break;
        default:
          break;
      }
      res.status(200).json({
        success: true,
      });
    }
  }
};
