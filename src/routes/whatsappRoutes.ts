import express, { Request, Response } from "express";
import { verifyWebhookToken } from "../services/Whatsapp/verifyWebhooks";
import { incomingMessages } from "../services/Whatsapp/incomingMessages";

const router = express.Router();

router.get("/messages", verifyWebhookToken());
router.post("/messages", incomingMessages);

export default router;
