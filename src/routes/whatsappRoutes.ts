import express, { Request, Response } from "express";
import { verifyWebhookToken } from "../Controllers/Whatsapp/verifyWebhooks";
import { incomingMessages } from "../Controllers/Whatsapp/incomingWhatsappMessagesHandler";

const router = express.Router();

router.get("/messages", verifyWebhookToken());
router.post("/messages", incomingMessages);

export default router;
