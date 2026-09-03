import {
  ActionSectionRows,
  Interactive,
  InteractiveActionSection,
  ReplyButtonObject,
} from "../types/types";
import {
  MAIN_MENU_REPLY_ID,
  VIEW_BOOKING_MENU_REPLY_ID,
  BOOKING_ID,
} from "../constants/whatsapp";

const MainMenuRows: ActionSectionRows[] = [
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

export const MainMenuSections: InteractiveActionSection[] = [
  {
    title: "Main Menu",
    rows: MainMenuRows,
  },
];

const ViewBookingMenuRows: ActionSectionRows[] = [
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

const BookingConfirmationRows: ActionSectionRows[] = [
  {
    id: BOOKING_ID.restartBooking,
    title: "Restart",
    description: "Cancel and start over",
  },
  {
    id: BOOKING_ID.confirmBooking,
    title: "Confirm",
    description: "Confirm your appointment details",
  },
];

export const BookingConfirmationSections: InteractiveActionSection[] = [
  {
    title: "Choose Action",
    rows: BookingConfirmationRows,
  },
];
