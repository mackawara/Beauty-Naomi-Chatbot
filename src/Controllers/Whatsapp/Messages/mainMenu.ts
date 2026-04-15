import {
  ActionSectionRows,
  Interactive,
  InteractiveActionSection,
  ReplyButtonObject,
} from "../../../types/types";
import {
  MAIN_MENU_REPLY_ID,
  VIEW_BOOKING_MENU_REPLY_ID,
  BOOKING_ID,
} from "../../../constants/whatsapp";
import { logger } from "../../../services/logger";
import { getRedisKeyValue, setRedisKeyValuePair } from "../../booking";
import whatsappMessager from "../outgoingWhatsappMessagesHandler";
import { Booking } from "../../../models/Bookings";
import { Service } from "../../../models/Services";
import UTILS from "../../../UTILS";
import { getAvailableSlots } from "../../../services/calBooking.service";

export const MainMenuRows: ActionSectionRows[] = [
  {
    id: MAIN_MENU_REPLY_ID.book_appointment,
    title: "Make A Booking",
    description: "Book an appointment with our beauty experts",
  },
  {
    id: MAIN_MENU_REPLY_ID.view_my_bookings,
    title: "View My Bookings",
    description: "Track your bookings in real-time",
  },
];

export const BookingConfirmationRows: ActionSectionRows[] = [
  {
    id: BOOKING_ID.fixDetails,
    title: "Fix Details",
    description: "Chnage you booking information or correct any mistakes",
  },
  {
    id: BOOKING_ID.confirm,
    title: "Confirm",
    description: "Confirm your booking with the details provided",
  },
];

export const BookingConfirmationSections: InteractiveActionSection[] = [
  {
    title: "Choose Action",
    rows: BookingConfirmationRows,
  },
];

export const MainMenuSections: InteractiveActionSection[] = [
  {
    title: "Main Menu",
    rows: MainMenuRows,
  },
];

export const ViewBookingMenuRows: ActionSectionRows[] = [
  {
    id: VIEW_BOOKING_MENU_REPLY_ID.cancel,
    title: "Cancel",
    description: "Cancel your existing appointment",
  },
  {
    id: VIEW_BOOKING_MENU_REPLY_ID.reschedule,
    title: "Reschedule",
    description: "Change your appointment date or time",
  },
];

export const ViewBookingMenuSections: InteractiveActionSection[] = [
  {
    title: "Manage Booking",
    rows: ViewBookingMenuRows,
  },
];

export const BookingTimePartMenuRows: ActionSectionRows[] = [
  {
    id: BOOKING_ID.earlyMorningSlots,
    title: "Morning Slots",
    description: "View available time slots in the morning",
  },
  {
    id: BOOKING_ID.afternoonSlots,
    title: "Afternoon Slots",
    description: "View available time slots in the afternoon",
  },
];

export const BookingTimePartMenuSections: InteractiveActionSection[] = [
  {
    title: "Choose Time of Day",
    rows: BookingTimePartMenuRows,
  },
];



export const getDateRows = (): ActionSectionRows[] => {
  const dates: ActionSectionRows[] = [];
  const today = new Date();

  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const formattedDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    const displayDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    dates.push({
      id: `${displayDate}`,
      title: formattedDate,
      description: `Available slots for ${displayDate}`,
    });
  }

  return dates;
};

export const getDateSelectionSections = (): InteractiveActionSection[] => {
  return [
    {
      title: "Select Available Date",
      rows: getDateRows(),
    },
  ];
};

const getTimeSlotsData = async (clientNumber: string): Promise<string[]> => {
  const bookingId = await getRedisKeyValue(clientNumber, "bookingId");
  const orderData = await Booking.findOne({ bookingId: bookingId }); // make this lean and also add error handling in case the booking is not found
  const productName = orderData?.serviceName || "";
  const service = await Service.findOne({ serviceName: productName }); // make the doc lean and also add error handling in case the service is not found
  const dateofBooking = await getRedisKeyValue(clientNumber, "bookingDate");
  if (!service || !dateofBooking) {
    logger.error(
      `Service not found for product: ${productName} or booking date not set for contact: ${clientNumber}`,
    );
    await whatsappMessager.sendFreeFormTextMessage(
      clientNumber,
      "*⚠️ Oops! Something went wrong while fetching available time slots. Please try again.*",
    );
    return [];
  }

  //check date fns
  const formatedDate = UTILS.convertToYYMMDD(dateofBooking);
  const availableSlots = await getAvailableSlots(
    parseInt(service?.eventTypeId) || 0,
    `20${formatedDate}`,
  );
  logger.info(
    `Available slots for service ${productName} on date ${dateofBooking}:`,
    availableSlots,
  );

   const availableSlotsData = availableSlots.data ?? [];
   await setRedisKeyValuePair(
    clientNumber,
    "availableTimeSlots",
    JSON.stringify(availableSlotsData),
  );
 return availableSlotsData;
};


export const getTimeSlotRows = async (
  timeSlotsData: string[],
): Promise<ActionSectionRows[]> => {
  const rows: ActionSectionRows[] = [];

  timeSlotsData.forEach((time) => {
    rows.push({
      id: `slot_${time}`,
      title: time,
      description: `Available at ${time}`,
    });
  });

  return rows;
};

export const getEarlyMorningTimeSlotRows = async (clientNumber: string): Promise<ActionSectionRows[]> => {
  const timeSlotsData = await getTimeSlotsData(clientNumber);
  const allSlots = await getTimeSlotRows(timeSlotsData);
  
  // Filter eraly morning slots (7:00- 9:45)
  const morningSlots = allSlots.filter((slot) => {
    const hour = parseInt(slot.title.split(':')[0]);
    return hour < 10;
  });
  
  return morningSlots;
};

export const getlateMorningTimeSlotRows = async (clientNumber: string): Promise<ActionSectionRows[]> => {
  const timeSlotsData = await getTimeSlotsData(clientNumber);
  const allSlots = await getTimeSlotRows(timeSlotsData);
  
  // Filter late morning slots (10:00 - 11:45)
  const morningSlots = allSlots.filter((slot) => {
    const hour = parseInt(slot.title.split(':')[0]);
    return hour < 15;
  });
  
  return morningSlots;
};

export const getAfternoonTimeSlotRows = async (clientNumber: string): Promise<ActionSectionRows[]> => {
  const timeSlotsData = await getTimeSlotsData(clientNumber);
  const allSlots = await getTimeSlotRows(timeSlotsData);
  
  // Filter afternoon slots (12:00 and after)
  const afternoonSlots = allSlots.filter((slot) => {
    const hour = parseInt(slot.title.split(':')[0]);
    return hour >= 12;
  });
  
  return afternoonSlots;
};


export const getMorningTimeSlotsSections = async (
  clientNumber: string,
): Promise<InteractiveActionSection[]> => {
  const morningRows = await getEarlyMorningTimeSlotRows(clientNumber);
  
  const sections: InteractiveActionSection[] = [];
  
  if (morningRows.length > 0) {
    sections.push({
      title: "🌅 Morning Slots",
      rows: morningRows,
    });
  }
  
  return sections;
};

export const getAfternoonTimeSlotsSections = async (
  clientNumber: string,
): Promise<InteractiveActionSection[]> => {
  const afternoonRows = await getAfternoonTimeSlotRows(clientNumber);
  
  const sections: InteractiveActionSection[] = [];
  
  if (afternoonRows.length > 0) {
    sections.push({
      title: "☀️ Afternoon Slots",
      rows: afternoonRows,
    });
  }
  
  return sections;
};

