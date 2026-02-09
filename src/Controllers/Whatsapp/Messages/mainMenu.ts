import {
  ActionSectionRows,
  Interactive,
  InteractiveActionSection,
  ReplyButtonObject,
} from "../../../types/types";
import { MAIN_MENU_PATHS } from "../../../constants/whatsapp";

export const MainMenuRows: ActionSectionRows[] = [
  {
    id: MAIN_MENU_PATHS.book_appointment,
    title: "Make A Booking",
    description: "Book an appointment with our beauty experts",
  },
  {
    id: MAIN_MENU_PATHS.view_my_bookings,
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
