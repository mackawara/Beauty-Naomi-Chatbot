import express from "express";
import { verifyWebhookToken } from "../Controllers/Whatsapp/verifyWebhooks";
import { incomingMessages } from "../Controllers/Whatsapp/incomingWhatsappMessagesHandler";
import { bookingFlowEndpoint } from "../Controllers/Whatsapp/Flows/flowEndpoint";

const router = express.Router();

router.get("/messages", verifyWebhookToken());
router.post("/messages", incomingMessages);
// Meta calls this for every screen transition in the booking Flow.
router.post("/flows", bookingFlowEndpoint);

export default router;
