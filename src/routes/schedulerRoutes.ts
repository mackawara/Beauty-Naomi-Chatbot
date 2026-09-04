import express from "express";
import { schedulerWebhook } from "../Controllers/Scheduler/schedulerWebhook";

const router = express.Router();

// Signed notifications from the scheduler: confirmations, reminders, OTPs.
router.post("/events", schedulerWebhook);

export default router;
