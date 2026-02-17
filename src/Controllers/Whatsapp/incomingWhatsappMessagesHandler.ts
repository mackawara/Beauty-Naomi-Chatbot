import { Request, Response } from "express";
import { logger } from "../../services/logger";
import { WebhookNotificationBody, InteractivePayLoad } from "../../types/types";
import CONVERSATION_CONTROLLER from "../Conversation/conversationController";

export const incomingMessages = async (req: Request, res: Response) => {
  const reqBody: WebhookNotificationBody = req.body;

  if (reqBody.object) {
    const { messages } = reqBody.entry[0].changes[0].value;
    if (messages) {
      const notificationType = messages[0].type;
      const clientNumber = messages[0].from;

      switch (notificationType) {
        case "text":
          const messageText = messages[0].text.body;
          {
            await CONVERSATION_CONTROLLER.textReplyHandler(
              clientNumber,
              messageText,
            );
          }
          break;
        case "interactive":
          {
            const interactivePayload: InteractivePayLoad =
              messages[0].interactive;
            await CONVERSATION_CONTROLLER.interactiveReplyHandler(
              clientNumber,
              interactivePayload,
            );
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
