import { ActionSectionRows, Interactive, InteractiveActionSection, ReplyButtonObject } from '../../../types/types';
import { MAIN_MENU_PATHS } from '../../../constants/whatsapp';

export const MainMenuRows: ActionSectionRows[] = [
  {
    id: MAIN_MENU_PATHS.book_appointment,
    title: "Book Appointment",
    description: "Book an appointment with our beauty experts"
  },
  {
    id: MAIN_MENU_PATHS.view_my_appointments,
    title: "View My Appointments",
    description: "Track your appointments in real-time"
  },
  {
    id: MAIN_MENU_PATHS.enquiries,
    title: "Enquiries / Feedback",
    description: "Get instant support or share your thoughts"
  },
  
]

export const MainMenuSections: InteractiveActionSection[] = [{
  title: 'Main Menu',
  rows: MainMenuRows
}]


