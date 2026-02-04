import axios from 'axios';
import { logger } from '../logger'
import { CONFIG } from '../../config';
import constants from '../../constants';
import UTILS from '../../UTILS';
import { Interactive } from '../../types/types';

const whatsappApiVersion = "v21.0";

export const messagesEndpointUrl: string = `https://graph.facebook.com/${whatsappApiVersion}/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages?access_token=${CONFIG.WHATSAPP_SYSTEM_TOKEN}`;
const headers = { "Content-Type": "application/json" };
const TAG = "[WHATSAPP-MESSAGING]";

const sendFreeFormTextMessage = async (
  receivingNumber: string,
  text: string
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
  interactiveObject: Interactive
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
      `${TAG}: message sent to ${receivingNumber}, status: ${result.statusText}`
    );
  } catch (err) {
    if (UTILS.isFacebookAPIError(err)) {
      const { message, fbtrace_id, error_data } = err.response.data.error;
      logger.error(
        `${TAG}: ${message}, ${error_data?.details} Facebook traceID : ${fbtrace_id}`
      );
    }
  }
};



const whatsappMessager = {
    sendFreeFormTextMessage,
    sendInteractive
}

export default whatsappMessager