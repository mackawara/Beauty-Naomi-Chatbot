import express, { Request, Response } from "express";
import { verifyWebhookToken } from "../services/Whatsapp/verifyWebhooks";

const router = express.Router();

router.get("/messages", verifyWebhookToken());
router.post("/messages", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Sending messages is working",
  });
});

export default router;
