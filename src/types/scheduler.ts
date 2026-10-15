// Response shapes of the in-house scheduler API (mackawara/scheduler).

export interface SchedulerService {
  id: string;
  name: string;
  description: string | null;
  baseDurationMinutes: number;
  bufferDurationMinutes: number;
  resourceType: string;
  priceCents: number;
  currency: string;
  catalogRetailerId: string | null;
}

export interface SchedulerDateSummary {
  timezone: string;
  from: string;
  days: number;
  service: { id: string; name: string };
  dates: { date: string; availableSlots: number }[];
}

export interface SchedulerSlot {
  start: string; // UTC ISO timestamp, accepted as slotStartTime when holding
  serviceEnd: string;
  endWithBuffer: string;
  localStart: string; // ISO timestamp in the salon's timezone
  staffIds?: string[];
}

export interface SchedulerSlots {
  date: string;
  timezone: string;
  service: { id: string; name: string; baseDurationMinutes: number; bufferDurationMinutes: number };
  slots: SchedulerSlot[];
}

export type SchedulerBookingStatus = "HOLD" | "BOOKED" | "CANCELLED" | "EXPIRED";

export interface SchedulerBookingView {
  id: string;
  status: SchedulerBookingStatus;
  staffId: string;
  serviceId: string;
  startsAt: string;
  serviceEndsAt: string;
  endsAt: string;
  holdExpiresAt: string | null;
  paymentReference: string | null;
}

export interface SchedulerBookingDetails extends SchedulerBookingView {
  service: { id: string; name: string; priceCents: number; currency: string } | null;
  staff: { id: string; name: string } | null;
  customer: { name?: string; phone?: string; socialHandle?: string } | null;
  timezone: string;
  localStart: string;
  address: string | null;
}

export interface SchedulerCustomer {
  name?: string;
  phone?: string;
}

export interface SchedulerWebhookEvent {
  id: string;
  type: string;
  createdAt: string;
  data: { appointmentId?: string; oldStartsAt?: string; newStartsAt?: string; [key: string]: unknown };
}
