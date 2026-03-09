import axios from "axios";
import { logger } from "../../services/logger";
import { CONFIG } from "../../config";
import constants from "../../constants";
import UTILS from "../../UTILS";
import { Interactive , InteractiveFlow} from "../../types/types";
import { isEmpty } from "lodash";


const whatsappApiVersion = "v21.0";

export const messagesEndpointUrl: string = `https://graph.facebook.com/${whatsappApiVersion}/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages?access_token=${CONFIG.WHATSAPP_SYSTEM_TOKEN}`;
const headers = { "Content-Type": "application/json" };
const TAG = "[WHATSAPP-MESSAGING]";

const sendFreeFormTextMessage = async (
  receivingNumber: string,
  text: string,
) => {
  logger.info(messagesEndpointUrl);
  await axios({
    method: "POST",
    url: messagesEndpointUrl,
    data: {
      recipient_type: constants.whatsapp.INDIVIDUAL,
      messaging_product: constants.whatsapp.WHATSAPP,
      to: receivingNumber,
      type: "text",
      text: { body: text },
      headers: headers,
    },
  }).catch((err: any) => {
    if (UTILS.isFacebookAPIError(err)) {
      logger.error(err.response.data.error.message);
    } else {
      logger.error(err);
    }
  });
};

const sendInteractive = async (
  receivingNumber: string,
  interactiveObject: Interactive,
) => {
  try {
    const result = await axios({
      method: "POST",
      url: messagesEndpointUrl,
      data: {
        recipient_type: constants.whatsapp.INDIVIDUAL,
        messaging_product: constants.whatsapp.WHATSAPP,
        to: receivingNumber,
        type: constants.whatsapp.INTERACTIVE,
        interactive: interactiveObject,
      },
    });
    logger.info(
      `${TAG}: message sent to ${receivingNumber}, status: ${result.statusText}`,
    );
  } catch (err) {
    if (UTILS.isFacebookAPIError(err)) {
      const { message, fbtrace_id, error_data } = err.response.data.error;
      logger.error(
        `${TAG}: ${message}, ${error_data?.details} Facebook traceID : ${fbtrace_id}`,
      );
    }
  }
};

export function createFlowInteractive(params: {
  bodyText: string;
  flowId: string;
  flowToken: string;
  flowCta: string;
  initialScreen: string;
  initialData?: Record<string, unknown>;
  headerText?: string;
  footerText?: string;
}): InteractiveFlow {
  const {
    bodyText,
    flowId,
    flowToken,
    flowCta,
    initialScreen,
    initialData,
    headerText,
    footerText,
  } = params;
  const flowActionPayload = {
    screen: initialScreen,
    data:
      isEmpty(initialData) || initialData === undefined ? null : initialData,
  };
  const interactive: InteractiveFlow = {
    type: "flow",
    //sub_type: "interactive",
    body: {
      text: bodyText.substring(0, 1024), // Enforce WhatsApp limit
    },
    action: {
      name: "flow",
      parameters: {
        mode: "published",
        flow_message_version: "3",
        flow_token: flowToken,
        flow_id: flowId,
        flow_cta: flowCta,
        flow_action: "navigate",
        flow_action_payload: {
          screen: initialScreen,
          data: isEmpty(initialData) ? undefined : initialData,
        },
      },
    },
  };

  // Add header if provided
  if (headerText) {
    interactive.header = {
      type: "text",
      text: headerText.substring(0, 60), // Enforce WhatsApp limit
    };
  }

  // Add footer if provided
  if (footerText) {
    interactive.footer = {
      text: footerText.substring(0, 60), // Enforce WhatsApp limit
    };
  }

  return interactive;
}


interface SendWhatsAppCatalogMessage {
  name: "catalog_message";
  parameters?: {
    thumbnail_product_retailer_id?: string; // Optional: If you want to feature a specific product thumbnail
    // catalog_id is part of the main action object for some interactive types, but for 'catalog_message' it's often implied or handled differently.
    // For 'catalog_message' type, the catalog is usually the one linked to the WABA.
    // If sending a multi-product message (type: 'product_list'), then catalog_id is explicit in action.
  };
  footer?: { text: string };
}

export interface WhatsAppSendCatalogMessageParams {
  phone: string;
  bodyText?: string;
  thumbnailProductRetailerId?: string;
  footer?: string;
}
/**
 * Send a WhatsApp interactive catalog message.
 * This typically opens the catalog associated with the WhatsApp Business Account.
 * A specific product can be featured as a thumbnail.
 */
export async function sendWhatsAppCatalogMessage({
  phone,
  bodyText = "Check out our catalog!", // Default body text
  thumbnailProductRetailerId,
  footer,
}: WhatsAppSendCatalogMessageParams): Promise<{
  success: boolean;
  messageId?: string;
  data?: unknown;
}> {
  try {
    const url = `https://graph.facebook.com/v24.0/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const cleanedPhoneNumber = phone.replace(/\D/g, "");
    if (!CONFIG.WHATSAPP_SYSTEM_TOKEN || !phone) {
      logger.error("WhatsApp credentials not configured for catalog message");
      return { success: false };
    }

    const interactivePayload: {
      type: "catalog_message";
      body: { text: string };
      action: SendWhatsAppCatalogMessage;
      footer?: { text: string };
    } = {
      type: "catalog_message",
      body: {
        text: bodyText.substring(0, 1024), // Max 1024 chars
      },
      action: {
        name: "catalog_message",
      },
      footer: {
        text: footer ? footer.substring(0, 60) : "Powered by Beauty Naomi",
      },
    };

    if (thumbnailProductRetailerId) {
      interactivePayload.action.parameters = {
        thumbnail_product_retailer_id: thumbnailProductRetailerId,
      };
    }

    const fullPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanedPhoneNumber,
      type: "interactive",
      interactive: interactivePayload,
    };
   
    const response = await axios(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.WHATSAPP_SYSTEM_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: JSON.stringify(fullPayload),
    });

    if (response.status !== 200) {
      const errorData = await response.data;
      logger.error(
        "WhatsApp API error for catalog_message:",
        errorData.error || errorData
      );
      return { success: false, data: errorData };
    }

    const data = response.data;
    logger.info(`WhatsApp catalog_message sent successfully to ${phone}`, data);

    return {
      success: true,
      messageId: data.messages[0].id,
      data: data, // Return the full API response data
    };
  } catch (error) {
    logger.error("Error sending WhatsApp catalog_message:", error);
    return {
      success: false,
      data: error instanceof Error ? error.message : error,
    };
  }
}

const whatsappMessager = {
  sendFreeFormTextMessage,
  sendInteractive,
  createFlowInteractive,
  sendWhatsAppCatalogMessage,
};

export default whatsappMessager;
