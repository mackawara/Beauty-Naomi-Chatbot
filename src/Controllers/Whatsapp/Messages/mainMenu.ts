import {
  ActionSectionRows,
  Interactive,
  InteractiveActionSection,
  ReplyButtonObject,
} from "../../../types/types";
import {
  MAIN_MENU_REPLY_ID,
  VIEW_BOOKING_MENU_REPLY_ID,
} from "../../../constants/whatsapp";

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
