import axios, { AxiosError } from "axios";
import { CONFIG } from "../config";
import { logger } from "../services/logger";
import {
  SchedulerBookingDetails,
  SchedulerBookingView,
  SchedulerCustomer,
  SchedulerDateSummary,
  SchedulerService,
  SchedulerSlots,
} from "../types/scheduler";

const TAG = "[SCHEDULER]";

/** Error returned by the scheduler API, keeping its machine-readable code (e.g. SLOT_UNAVAILABLE). */
export class SchedulerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SchedulerError";
  }
}

const schedulerApi = axios.create({
  baseURL: CONFIG.SCHEDULER_API_URL,
  timeout: CONFIG.SCHEDULER_API_TIMEOUT,
  headers: { "content-type": "application/json", "x-api-key": CONFIG.SCHEDULER_API_KEY },
});

const toSchedulerError = (error: unknown): SchedulerError => {
  if (error instanceof AxiosError) {
    const body = error.response?.data as { error?: { code?: string; message?: string } } | undefined;
    if (body?.error?.code) {
      return new SchedulerError(body.error.code, body.error.message ?? body.error.code, error.response?.status);
    }
    const code = error.code === "ECONNABORTED" ? "SCHEDULER_TIMEOUT" : "SCHEDULER_UNREACHABLE";
    return new SchedulerError(code, error.message, error.response?.status);
  }
  return new SchedulerError("SCHEDULER_ERROR", error instanceof Error ? error.message : "Unknown error");
};

async function request<T>(method: "get" | "post", path: string, options: {
  params?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
} = {}): Promise<T> {
  try {
    const response = await schedulerApi.request<{ data: T }>({
      method,
      url: path,
      params: options.params,
      data: options.body,
      headers: options.headers,
    });
    return response.data.data;
  } catch (error) {
    const schedulerError = toSchedulerError(error);
    logger.warn(`${TAG} ${method.toUpperCase()} ${path} failed: ${schedulerError.code}`);
    throw schedulerError;
  }
}

/** The active scheduler service mapped to a WhatsApp catalog product, or null. */
export const findServiceByRetailerId = async (retailerId: string): Promise<SchedulerService | null> => {
  const services = await request<SchedulerService[]>("get", "/api/services", {
    params: { catalogRetailerId: retailerId },
  });
  return services[0] ?? null;
};

/** Upcoming dates that have at least one open slot for the service (any staff). */
export const getAvailableDates = (serviceId: string, days = 14, from?: string) =>
  request<SchedulerDateSummary>("get", "/api/availability/dates", { params: { serviceId, days, from } });

/** Open slots for a service on a local date (YYYY-MM-DD), across any available staff. */
export const getSlots = (serviceId: string, date: string) =>
  request<SchedulerSlots>("get", "/api/slots/available", { params: { serviceId, date } });

/** Hold a slot; the scheduler assigns any free staff member. Safe to retry with the same key. */
export const holdSlot = (input: {
  serviceId: string;
  slotStartTime: string;
  customer: SchedulerCustomer;
  idempotencyKey: string;
}) =>
  request<SchedulerBookingView>("post", "/api/bookings/hold", {
    body: { serviceId: input.serviceId, slotStartTime: input.slotStartTime, customer: input.customer },
    headers: { "idempotency-key": input.idempotencyKey },
  });

export const confirmHold = (holdId: string) =>
  request<SchedulerBookingView>("post", "/api/bookings/confirm", { body: { holdId } });

export const getBooking = (bookingId: string) =>
  request<SchedulerBookingDetails>("get", `/api/bookings/${encodeURIComponent(bookingId)}`);

// check the health of the scheduler API
export const schedulerCheckLive = async () => {
  try {
    const response = await axios.get(`${CONFIG.SCHEDULER_API_URL}/health/live`, {
      timeout: CONFIG.SCHEDULER_API_TIMEOUT,
    });
    logger.info('Scheduler API Status live check:', response.data);
    return {
      message: "Scheduler API status received successfully",
      status:"live",
      data: response.data
    };
  } catch (error: any) {
    logger.error('Error checking scheduler health:', error);
    return {
      message: "Error checking scheduler health",
      status:"down",
      data: error.message
    };
  }
}

//check if the scheduler is ready
export const schedulerCheckReady = async () => {
  try {
    const response = await axios.get(`${CONFIG.SCHEDULER_API_URL}/health/ready`, {
      timeout: CONFIG.SCHEDULER_API_TIMEOUT,
    });
    logger.info('Scheduler API Status ready check:', response.data);
    return {
      message: "Scheduler API readiness check received successfully",
      status: "ready",
      data: response.data
    };
  } catch (error: any) {
    logger.error('Error checking scheduler readiness:', error);
    return {
      message: "Error checking scheduler readiness",
      status: "not ready",
      data: error.message
    };
  }
}

const schedulerService = {
  findServiceByRetailerId,
  getAvailableDates,
  getSlots,
  holdSlot,
  confirmHold,
  getBooking,
};

export default schedulerService;
