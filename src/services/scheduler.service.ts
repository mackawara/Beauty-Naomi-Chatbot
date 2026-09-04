import axios, { AxiosError } from "axios";
import { CONFIG } from "../config";
import { logger } from "./logger";
import type {
  ServiceResponse,
  TSchedulerBooking,
  TSchedulerCustomerBooking,
  TSchedulerHold,
  TSchedulerService,
  TSchedulerSlotSearch,
  TSchedulerStaff,
} from "../types/types";

const TAG = "[SCHEDULER]";

const client = axios.create({
  baseURL: CONFIG.SCHEDULER_BASE_URL,
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",
    // The chatbot is server-side, so it carries the secret key and can read
    // full booking details.
    "x-api-key": CONFIG.SCHEDULER_API_KEY,
  },
});

/**
 * The scheduler answers `{ data }` on success and `{ error: { code, message } }`
 * on failure. Its messages are written for people ("That time is not available
 * for this service"), so they are passed through rather than replaced.
 */
function toFailure(error: unknown, fallback: string): ServiceResponse<never> {
  const response = (error as AxiosError<{ error?: { code: string; message: string } }>)?.response;
  const apiError = response?.data?.error;
  logger.error(`${TAG} ${fallback}`, {
    status: response?.status,
    code: apiError?.code,
    message: apiError?.message ?? (error instanceof Error ? error.message : "Unknown error"),
  });
  return { success: false, error: apiError?.message ?? fallback, code: apiError?.code };
}

export const listServices = async (): Promise<ServiceResponse<TSchedulerService[]>> => {
  try {
    const response = await client.get<{ data: TSchedulerService[] }>("/api/services");
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "Could not load the service list");
  }
};

export const listStaff = async (serviceId?: string): Promise<ServiceResponse<TSchedulerStaff[]>> => {
  try {
    const response = await client.get<{ data: TSchedulerStaff[] }>("/api/staff", {
      params: serviceId ? { serviceId } : undefined,
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "Could not load the stylist list");
  }
};

/**
 * Availability across every stylist qualified for the service, so the customer
 * is offered every time the salon can take them rather than one person's diary.
 */
export const searchSlots = async (
  serviceId: string,
  date: string,
  staffId?: string,
): Promise<ServiceResponse<TSchedulerSlotSearch>> => {
  try {
    const response = await client.get<{ data: TSchedulerSlotSearch }>("/api/slots/search", {
      params: { serviceId, date, ...(staffId ? { staffId } : {}) },
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "Could not load available times");
  }
};

/**
 * Reserves the slot for a few minutes. `idempotencyKey` must be stable for one
 * booking attempt so a retry or a duplicated webhook cannot double-book.
 * Omitting `staffId` lets the scheduler assign whoever is free.
 */
export const createHold = async (input: {
  serviceId: string;
  slotStartTime: string;
  customer: { name?: string; phone?: string; socialHandle?: string };
  idempotencyKey: string;
  staffId?: string;
}): Promise<ServiceResponse<TSchedulerHold>> => {
  try {
    const { idempotencyKey, ...body } = input;
    const response = await client.post<{ data: TSchedulerHold }>("/api/bookings/hold", body, {
      headers: { "idempotency-key": idempotencyKey },
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "Could not hold that time");
  }
};

export const confirmHold = async (
  holdId: string,
  paymentReference?: string,
): Promise<ServiceResponse<TSchedulerHold>> => {
  try {
    const response = await client.post<{ data: TSchedulerHold }>("/api/bookings/confirm", {
      holdId,
      paymentReference,
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "Could not confirm the booking");
  }
};

export const getBooking = async (bookingId: string): Promise<ServiceResponse<TSchedulerBooking>> => {
  try {
    const response = await client.get<{ data: TSchedulerBooking }>(`/api/bookings/${bookingId}`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "Could not load the booking");
  }
};

/** Codes sent to a customer's phone so they can list and manage their bookings. */
export const requestCustomerOtp = async (
  phone: string,
): Promise<ServiceResponse<{ expiresAt: string }>> => {
  try {
    const response = await client.post<{ data: { expiresAt: string } }>("/api/customers/otp/request", {
      phone,
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "Could not send a verification code");
  }
};

export const verifyCustomerOtp = async (
  phone: string,
  code: string,
): Promise<ServiceResponse<{ accessToken: string; expiresIn: number }>> => {
  try {
    const response = await client.post<{ data: { accessToken: string; expiresIn: number } }>(
      "/api/customers/otp/verify",
      { phone, code },
    );
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "That code did not work");
  }
};

export const listCustomerBookings = async (
  accessToken: string,
  includePast = false,
): Promise<ServiceResponse<TSchedulerCustomerBooking[]>> => {
  try {
    const response = await client.get<{ data: TSchedulerCustomerBooking[] }>("/api/customers/me/bookings", {
      headers: { authorization: `Bearer ${accessToken}` },
      params: includePast ? { includePast: "true" } : undefined,
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "Could not load your bookings");
  }
};

export const cancelBooking = async (
  bookingId: string,
  accessToken: string,
  reason?: string,
): Promise<ServiceResponse<TSchedulerHold>> => {
  try {
    const response = await client.post<{ data: TSchedulerHold }>(
      `/api/bookings/${bookingId}/cancel`,
      { reason },
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "Could not cancel the booking");
  }
};

export const rescheduleBooking = async (
  bookingId: string,
  accessToken: string,
  newSlotStartTime: string,
): Promise<ServiceResponse<TSchedulerHold>> => {
  try {
    const response = await client.patch<{ data: TSchedulerHold }>(
      `/api/bookings/${bookingId}/reschedule`,
      { newSlotStartTime },
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    return { success: true, data: response.data.data };
  } catch (error) {
    return toFailure(error, "Could not move the booking");
  }
};

const SCHEDULER = {
  listServices,
  listStaff,
  searchSlots,
  createHold,
  confirmHold,
  getBooking,
  requestCustomerOtp,
  verifyCustomerOtp,
  listCustomerBookings,
  cancelBooking,
  rescheduleBooking,
};

export default SCHEDULER;
