import { Request, Response } from "express";
import { logger } from "../../../services/logger";
import {
  decryptFlowRequest,
  encryptFlowResponse,
  FlowDecryptionError,
  type EncryptedFlowRequest,
} from "./flowCrypto";
import { handleBookingFlow, type FlowRequestPayload } from "./bookingFlow";

const TAG = "[FLOW-ENDPOINT]";

/**
 * Meta's data_exchange endpoint for the booking Flow. Requests and responses
 * are end-to-end encrypted, and the reply is a bare base64 string rather than
 * JSON.
 */
export const bookingFlowEndpoint = async (req: Request, res: Response): Promise<void> => {
  let decrypted;
  try {
    decrypted = decryptFlowRequest<FlowRequestPayload>(req.body as EncryptedFlowRequest);
  } catch (error) {
    // 421 tells Meta our key pair is stale so it can re-send the public key.
    // Any other status makes it retry a request we can never read.
    const status = error instanceof FlowDecryptionError ? error.statusCode : 500;
    logger.error(`${TAG} Rejecting an undecryptable request`, error);
    res.status(status).send();
    return;
  }

  const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decrypted;
  try {
    logger.info(`${TAG} ${decryptedBody.action} on ${decryptedBody.screen ?? "-"}`);
    const response = await handleBookingFlow(decryptedBody);
    res
      .status(200)
      .type("text/plain")
      .send(encryptFlowResponse(response, aesKeyBuffer, initialVectorBuffer));
  } catch (error) {
    logger.error(`${TAG} Failed to handle the flow request`, error);
    // The reply is still encrypted: an unencrypted body would fail Meta's
    // checks and show the customer nothing at all.
    res
      .status(200)
      .type("text/plain")
      .send(
        encryptFlowResponse(
          {
            version: decryptedBody.version ?? "3.0",
            screen: decryptedBody.screen ?? "SERVICE",
            data: {
              has_error: true,
              error_message: "Something went wrong on our side. Please try again.",
            },
          },
          aesKeyBuffer,
          initialVectorBuffer,
        ),
      );
  }
};

export default bookingFlowEndpoint;
