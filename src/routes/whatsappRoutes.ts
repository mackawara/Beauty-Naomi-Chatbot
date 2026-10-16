import express, { Request, Response } from "express";
import { verifyWebhookToken } from "../Controllers/Whatsapp/verifyWebhooks";
import { incomingMessages } from "../Controllers/Whatsapp/incomingWhatsappMessagesHandler";
import { flowDataEndpoint } from "../Controllers/Whatsapp/flows/flowEndpoint";

const router = express.Router();

router.get("/messages", verifyWebhookToken());
router.post("/messages", incomingMessages);
router.post("/flows", flowDataEndpoint);

export default router;
