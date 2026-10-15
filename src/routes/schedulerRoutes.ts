import { Router } from 'express';
import { apiHealthCheck, apiHealthCheckReady } from '../schedulerController/schedulerHealth.controller';
import { createSchedulerEventsHandler } from '../Controllers/Scheduler/schedulerEvents';
import { CONFIG } from '../config';
import { redisClient } from '../services/redis';
import schedulerService from '../services/schedulerService';
import whatsappMessager from '../Controllers/Whatsapp/outgoingWhatsappMessagesHandler';
import { Booking } from '../models/Bookings';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
const eventKey = (eventId: string) => `scheduler-event:${eventId}`;

const schedulerRoutes = Router();

schedulerRoutes.get('/health/live', apiHealthCheck);
schedulerRoutes.get('/health/ready', apiHealthCheckReady);

// Notification webhook from the in-house scheduler (reminders, cancellations, reschedules)
schedulerRoutes.post(
  '/scheduler/events',
  createSchedulerEventsHandler({
    secret: CONFIG.SCHEDULER_WEBHOOK_SECRET,
    templates: {
      reminder: CONFIG.WHATSAPP_TEMPLATE_REMINDER,
      cancelled: CONFIG.WHATSAPP_TEMPLATE_CANCELLED,
      rescheduled: CONFIG.WHATSAPP_TEMPLATE_RESCHEDULED,
    },
    claimEvent: async (eventId) =>
      (await redisClient.set(eventKey(eventId), '1', { NX: true, EX: SEVEN_DAYS_SECONDS })) === 'OK',
    releaseEvent: async (eventId) => {
      await redisClient.del(eventKey(eventId));
    },
    getBooking: schedulerService.getBooking,
    sendTemplate: whatsappMessager.sendTemplateMessage,
    updateLocalBooking: async (appointmentId, change) => {
      await Booking.updateOne({ schedulerAppointmentId: appointmentId }, { $set: change });
    },
  }),
);

export default schedulerRoutes;
