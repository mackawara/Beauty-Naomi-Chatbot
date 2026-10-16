import { Request, Response } from "express";
import crypto from "crypto";
import { CONFIG } from "../../../config";
import { logger } from "../../../services/logger";
import { EncryptedFlowRequest, FlowResponse } from "../../../types/flows";
import {
  decryptFlowRequest,
  encryptFlowResponse,
  FlowDecryptionError,
  isValidMetaSignature,
  loadPrivateKey,
} from "./flowCrypto";
import { routeFlowRequest } from "./flowRouter";

const TAG = "[FLOW-ENDPOINT]";
let privateKey: crypto.KeyObject | null = null;

const getPrivateKey = () => {
  if (!privateKey) {
    privateKey = loadPrivateKey(CONFIG.WHATSAPP_FLOW_PRIVATE_KEY, CONFIG.WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE);
  }
  return privateKey;
};

/** Data endpoint for WhatsApp Flows: decrypts the request, routes it and returns the encrypted response. */
export const flowDataEndpoint = async (req: Request, res: Response) => {
  if (!isValidMetaSignature(req.rawBody, req.get("x-hub-signature-256"), CONFIG.WHATSAPP_APP_SECRET)) {
    logger.warn(`${TAG} Rejected request with an invalid signature`);
    return res.status(432).send();
  }

  let decrypted;
  try {
    decrypted = decryptFlowRequest(req.body as EncryptedFlowRequest, getPrivateKey());
  } catch (error) {
    if (error instanceof FlowDecryptionError) {
      logger.warn(`${TAG} Could not decrypt request: ${error.message}`);
      return res.status(421).send();
    }
    throw error;
  }

  const { body, aesKey, initialVector } = decrypted;
  let response: FlowResponse;
  try {
    if (body.action === "ping") {
      response = { data: { status: "active" } };
    } else if (body.data?.error) {
      logger.warn(`${TAG} Flow client reported an error on ${body.screen}: ${body.data.error_message ?? body.data.error}`);
      response = { data: { acknowledged: true } };
    } else {
      response = await routeFlowRequest(body);
    }
  } catch (error) {
    logger.error(`${TAG} Handler failed for ${body.action} ${body.screen ?? ""}`, error);
    return res.status(500).send();
  }

  return res.status(200).type("text/plain").send(encryptFlowResponse(response, aesKey, initialVector));
};
