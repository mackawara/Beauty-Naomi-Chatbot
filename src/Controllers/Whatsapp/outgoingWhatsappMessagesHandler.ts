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

const whatsappMessager = {
  sendFreeFormTextMessage,
  sendInteractive,
  createFlowInteractive
};

export default whatsappMessager;
