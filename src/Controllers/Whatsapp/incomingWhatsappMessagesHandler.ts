import express, { Request, Response } from "express";
import { logger } from "../../services/logger";
import { CONFIG } from "../../config";
import messageComposer from "./messagesComposer";
import { WebhookNotificationBody } from "../../types/types";
import whatsappMessager from "./outgoingWhatsappMessagesHandler";
import { MainMenuSections } from "./Messages/mainMenu";

export const incomingMessages = async (req: Request, res: Response) => {
  const reqBody: WebhookNotificationBody = req.body;

  if (reqBody.object) {
    const { messages } = reqBody.entry[0].changes[0].value;
    if (messages) {
      const notificationType = messages[0].type;
      const msgId = messages[0].id;
      const from = messages[0].from;
      if (notificationType === "text") {
        const text: string = messages[0].text.body;

        const entry = reqBody.entry;
        const clientNumber = from;

        logger.info(`[INCOMING_MESSAGES] Received incoming message: ${text}`);
        res.status(200).json({
          success: true,
        });

        if (messages) {
          try {
             whatsappMessager.sendInteractive(
            clientNumber,
            messageComposer.messageWithReplyList({
                text: `Hi, ${clientNumber || "😃"} 👋\n\n*Welcome to Beauty Naomi Chatbot*\n\nPlease click on any of the buttons below to proceed. To restart anytime, simply send "hi". `,
                sections: MainMenuSections,
                listName: "Main Menu"
               
            })
          )
          } catch (err) {
            logger.error(err);
          }
        }
      }
    }
  }
};
