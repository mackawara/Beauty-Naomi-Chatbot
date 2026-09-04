export const WHATSAPP: string = "whatsapp";
export const INTERACTIVE: string = "interactive";
export const INDIVIDUAL: string = "individual";
export const ENGLISH_US: string = "en_US";

export const MAIN_MENU_REPLY_ID = {
  book_appointment: "book_appointment",
  view_my_bookings: "view_my_bookings",
};

export const VIEW_BOOKING_MENU_REPLY_ID = {
  cancel: "cancel",
  reschedule: "reschedule",
};

export const BUTTONS_REPLY_ID = {
  continue: "continue",
};

export const TEXT_COMMANDS_ID = {
  hi: "hi",
  menu: "menu",
  book: "book",
  bookings: "bookings",
  help: "help",
};

/**
 * Reply IDs carry the booking they act on, since WhatsApp gives us nothing but
 * the row id back. Prefixes keep parsing unambiguous.
 */
export const MANAGE_REPLY_PREFIX = {
  cancel: "mb-cancel:",
  reschedule: "mb-move:",
  date: "mb-date:",
  time: "mb-time:",
  confirmCancel: "mb-confirm-cancel",
  keepBooking: "mb-keep",
};