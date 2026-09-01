import axios, { AxiosResponse } from "axios";
import { CONFIG } from "../config";
import { TCreateBooking, TSlot, TCreateService, ICalcomSlotsResponse, ServiceResponse } from "../types/types";
import { endOfDay, format, isBefore, parseISO, startOfDay } from "date-fns";
const {CALCOM_API_KEY, CALCOM_VERSION, CALCOM_API_VERSION, CALCOM_API_VERSION_BOOKING} = CONFIG;

const calBaseUrl = `https://api.cal.com/v${CALCOM_VERSION}`

export const createService = async (
  title: string,
  durationInMinutes: number,
): Promise<ServiceResponse<{eventTypeId: number; title: string; lengthInMinutes: number;}>> => {
  if (!title || !durationInMinutes || durationInMinutes < 1) {
    return { success: false, error: "Invalid title or duration" };
  };

  const createServicePayload: TCreateService = {
    title,
    slug: title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
    lengthInMinutes: durationInMinutes,
    slotInterval: 15
  };

  try {
    const response = await axios.post(
      `${calBaseUrl}/event-types`,
      createServicePayload,
      {
        headers: {
          Authorization: `Bearer ${CALCOM_API_KEY}`,
          "cal-api-version": CALCOM_API_VERSION,
        },
      },
    );

    if (response.status === 201) {
      const { id: eventTypeId, lengthInMinutes } = response.data.data;
      return { success: true, data: { eventTypeId, title, lengthInMinutes } };
    } else {
      return { success: false, error: "Failed to create service" };
    }
  } catch (error: any) {
      return { success: false, error: error.response?.data?.error?.message || "Unknown error" };
  };
};

export const createBooking = async (
  day: string,
  time: string,
  attendeeName: string,
  attendeeEmail: string,
  eventTypeId: number,
  phoneNumber: string
): Promise<ServiceResponse<any>> => {
  if (!day || !attendeeName || !attendeeEmail) {
    return { success: false, error: "Missing required fields" };
  };

  const payload: TCreateBooking = {
    start: `${day}T${time}:00.000Z`,
    attendee: {
      name: attendeeName,
      email: attendeeEmail,
      timeZone: "Africa/Harare",
      phoneNumber
    },
    eventTypeId,
  };

  try {
    const response = await axios.post(
      `${calBaseUrl}/bookings`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${CALCOM_API_KEY}`,
          "Content-Type": "application/json",
          "cal-api-version": CALCOM_API_VERSION_BOOKING,
        },
      },
    );

    return { success: true, data: response.data.data };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error?.message || "Failed to create booking" };
  };
};

export const getAvailableSlots = async (eventTypeId: number, date: string): Promise<ServiceResponse<string[]>> => {
  if (!eventTypeId || !date) {
    return { success: false, error: "Date and eventTypeId not provided" };
  };

  //check if provided date is before today
  if(isBefore(parseISO(date), startOfDay(new Date()))) {
    return { success: true, data: [] };
  };

  try {
    const response: AxiosResponse<ICalcomSlotsResponse> = await axios.get(`${calBaseUrl}/slots/available`, {
      params: {
        eventTypeId,
        startTime: `${startOfDay(date).toISOString()}`,
        endTime: `${endOfDay(date).toISOString()}`,
        timeZone: "Africa/Harare",
      },
      headers: {
        Authorization: `Bearer ${CALCOM_API_KEY}`,
        "cal-api-version": CALCOM_API_VERSION,
      },
    });

    const slots = response.data?.data?.slots[date];
    if (!slots) {
      return { success: true, data: [] };
    };

  

    const freeSlotTimes: string[] = [];
    slots.forEach((slot: TSlot) => {
      const { time } = slot;
      const formattedTime = parseISO(time);
      freeSlotTimes.push(
        format(formattedTime, "HH:mm")
      );
    });

    return { success: true, data: freeSlotTimes };
  } catch (error: any) {
    return { success: false, error: "Failed to fetch slots" };
  };
};
