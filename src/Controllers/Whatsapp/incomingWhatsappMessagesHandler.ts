import { Request, Response } from "express";
import { logger } from "../../services/logger";
import { WebhookNotificationBody, InteractivePayLoad , WhatsAppOrderPayload} from "../../types/types";
import CONVERSATION_CONTROLLER from "../Conversation/conversationController";
import { processWhatsAppOrder } from "./order/whatsappOrderHandler";

export const incomingMessages = async (req: Request, res: Response) => {
  try {
    await handleNotification(req.body as WebhookNotificationBody);
  } catch (error) {
    logger.error("Error handling WhatsApp webhook notification", error);
  }
  // Always acknowledge, including status-only notifications and failures,
  // otherwise Meta keeps retrying the same notification.
  res.status(200).json({ success: true });
};

const handleNotification = async (reqBody: WebhookNotificationBody) => {
  if (reqBody?.object) {
    const messages = reqBody.entry?.[0]?.changes?.[0]?.value?.messages;
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
            logger.info("Processing WhatsApp catalog order from:", clientNumber);
          const rawOrder = messages[0].order;
             const orderPayload: WhatsAppOrderPayload = {
               ...rawOrder,
               product_items: rawOrder?.product_items?.map((item: any) => ({
                 ...item,
                 quantity:
                   typeof item.quantity === "string"
                     ? Number(item.quantity)
                     : item.quantity,
                 item_price:
                   typeof item.item_price === "string"
                     ? Number(item.item_price)
                     : item.item_price,
               })),
             };

          const profileName = reqBody.entry[0].changes[0].value.contacts?.[0]?.profile?.name;
          await processWhatsAppOrder(clientNumber, orderPayload, profileName);
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
    }
  }
};
