import { logger } from "../../../services/logger";
import SCHEDULER from "../../../services/scheduler.service";
import MANAGE_SESSION, { type ManageSession } from "../../../services/manageSession";
import whatsappMessager from "../outgoingWhatsappMessagesHandler";
import messageComposer from "../messagesComposer";
import { longWhen } from "./bookingConversation";
import { MANAGE_REPLY_PREFIX } from "../../../constants/whatsapp";
import type { ActionSectionRows, TSchedulerCustomerBooking } from "../../../types/types";

const TAG = "[MANAGE-BOOKING]";
/** WhatsApp allows at most 10 rows across all sections of a list message. */
const MAX_ROWS = 10;
const DAYS_AHEAD = 10;

const send = whatsappMessager.sendFreeFormTextMessage;

async function sendList(
  phone: string,
  text: string,
  listName: string,
  rows: ActionSectionRows[],
  sectionTitle: string,
): Promise<void> {
  await whatsappMessager.sendInteractive(
    phone,
    messageComposer.messageWithReplyList({
      text,
      listName,
      sections: [{ title: sectionTitle, rows: rows.slice(0, MAX_ROWS) }],
    }),
  );
}

/** Row titles are capped at 24 characters by WhatsApp. */
function rowTitle(value: string): string {
  return value.length > 24 ? `${value.slice(0, 23)}…` : value;
}

/** Starts the verify-by-code flow so we never show bookings to the wrong person. */
export async function startManageBookings(phone: string): Promise<void> {
  const requested = await SCHEDULER.requestCustomerOtp(phone);
  if (!requested.success) {
    await send(phone, `Sorry, we couldn't send you a code right now. ${requested.error ?? ""}`.trim());
    return;
  }
  await MANAGE_SESSION.saveManageSession(phone, { stage: "AWAITING_OTP", otpAttempts: 0 });
  await send(
    phone,
    "*Let's find your bookings* 🔎\n\n" +
      "For your security, we've sent a *6-digit code* to this number.\n\n" +
      "Reply with the code to see and manage your appointments.",
  );
}

async function showBookings(phone: string, session: ManageSession): Promise<void> {
  const bookings = (session.bookings ?? []).filter((booking) => booking.status === "BOOKED");
  if (!bookings.length) {
    await send(
      phone,
      "You have no upcoming bookings.\n\nReply *hi* and choose *Make A Booking* to book one.",
    );
    await MANAGE_SESSION.clearManageSession(phone);
    return;
  }

  const rows: ActionSectionRows[] = [];
  for (const [index, booking] of bookings.slice(0, 5).entries()) {
    const label = `${index + 1}. ${booking.service?.name ?? "Service"}`;
    if (booking.canReschedule) {
      rows.push({
        id: `${MANAGE_REPLY_PREFIX.reschedule}${booking.id}`,
        title: rowTitle(`Move ${label}`),
        description: longWhen(booking.startsAt).slice(0, 72),
      });
    }
    if (booking.canCancel) {
      rows.push({
        id: `${MANAGE_REPLY_PREFIX.cancel}${booking.id}`,
        title: rowTitle(`Cancel ${label}`),
        description: longWhen(booking.startsAt).slice(0, 72),
      });
    }
  }

  const summary = bookings
    .map((booking, index) => {
      const parts = [
        `*${index + 1}.* ${booking.service?.name ?? "Service"}`,
        `   📅 ${longWhen(booking.startsAt)}`,
      ];
      if (booking.staff) parts.push(`   👩 ${booking.staff.name}`);
      if (!booking.canReschedule) parts.push("   ⚠️ Too close to move — cancel or call us");
      return parts.join("\n");
    })
    .join("\n\n");

  if (!rows.length) {
    await send(phone, `*Your bookings*\n\n${summary}\n\nThese can no longer be changed here. Please call us.`);
    return;
  }
  await sendList(phone, `*Your bookings*\n\n${summary}`, "Manage", rows, "Choose an action");
}

/** Verifies the code, then lists what the customer can act on. */
export async function handleOtpReply(phone: string, code: string): Promise<boolean> {
  const session = await MANAGE_SESSION.getManageSession(phone);
  if (session?.stage !== "AWAITING_OTP") return false;

  const verified = await SCHEDULER.verifyCustomerOtp(phone, code);
  if (!verified.success || !verified.data) {
    const attempts = (session.otpAttempts ?? 0) + 1;
    if (attempts >= 3) {
      await MANAGE_SESSION.clearManageSession(phone);
      await send(phone, "That code didn't work. Reply *hi* to start again.");
      return true;
    }
    await MANAGE_SESSION.updateManageSession(phone, { otpAttempts: attempts });
    await send(phone, `${verified.error ?? "That code didn't work."} Please try again.`);
    return true;
  }

  const bookings = await SCHEDULER.listCustomerBookings(verified.data.accessToken);
  const updated = await MANAGE_SESSION.updateManageSession(phone, {
    stage: "READY",
    accessToken: verified.data.accessToken,
    tokenExpiresAt: Date.now() + verified.data.expiresIn * 1000,
    bookings: bookings.data ?? [],
    otpAttempts: 0,
  });
  await showBookings(phone, updated!);
  return true;
}

function findBooking(session: ManageSession, bookingId: string): TSchedulerCustomerBooking | undefined {
  return session.bookings?.find((booking) => booking.id === bookingId);
}

async function requireToken(phone: string, session: ManageSession | null): Promise<string | null> {
  if (session?.accessToken && (session.tokenExpiresAt ?? 0) > Date.now()) return session.accessToken;
  await send(phone, "Your session timed out. Reply *hi* and choose *View My Bookings* to start again.");
  await MANAGE_SESSION.clearManageSession(phone);
  return null;
}

export async function startCancel(phone: string, bookingId: string): Promise<void> {
  const session = await MANAGE_SESSION.getManageSession(phone);
  if (!(await requireToken(phone, session))) return;
  const booking = findBooking(session!, bookingId);
  if (!booking) {
    await send(phone, "We couldn't find that booking. Reply *hi* to start again.");
    return;
  }
  await MANAGE_SESSION.updateManageSession(phone, {
    stage: "AWAITING_CANCEL_CONFIRM",
    selectedBookingId: bookingId,
  });
  await whatsappMessager.sendInteractive(
    phone,
    messageComposer.messageWithReplyButtons({
      text:
        `*Cancel this booking?*\n\n` +
        `💅 ${booking.service?.name ?? "Service"}\n` +
        `📅 ${longWhen(booking.startsAt)}\n\n` +
        `This cannot be undone.`,
      buttons: [
        { type: "reply", reply: { id: MANAGE_REPLY_PREFIX.confirmCancel, title: "Yes, cancel" } },
        { type: "reply", reply: { id: MANAGE_REPLY_PREFIX.keepBooking, title: "Keep it" } },
      ],
    }),
  );
}

export async function confirmCancel(phone: string): Promise<void> {
  const session = await MANAGE_SESSION.getManageSession(phone);
  const token = await requireToken(phone, session);
  if (!token || !session?.selectedBookingId) return;

  const cancelled = await SCHEDULER.cancelBooking(session.selectedBookingId, token);
  if (!cancelled.success) {
    await send(phone, `We couldn't cancel that booking. ${cancelled.error ?? ""}`.trim());
    return;
  }
  await MANAGE_SESSION.clearManageSession(phone);
  await send(
    phone,
    "*Booking cancelled.* We're sorry to miss you! 💛\n\nReply *hi* whenever you'd like to book again.",
  );
}

export async function keepBooking(phone: string): Promise<void> {
  await MANAGE_SESSION.updateManageSession(phone, { stage: "READY", selectedBookingId: undefined });
  await send(phone, "No changes made — your booking is still on. See you then! ✨");
}

function dateRows(timezone: string): ActionSectionRows[] {
  return Array.from({ length: DAYS_AHEAD }, (_, index) => {
    const target = new Date(Date.now() + index * 86_400_000);
    const value = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(target);
    const label = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(target);
    return {
      id: `${MANAGE_REPLY_PREFIX.date}${value}`,
      title: rowTitle(index === 0 ? `Today, ${label}` : label),
    };
  });
}

export async function startReschedule(phone: string, bookingId: string): Promise<void> {
  const session = await MANAGE_SESSION.getManageSession(phone);
  if (!(await requireToken(phone, session))) return;
  const booking = findBooking(session!, bookingId);
  if (!booking) {
    await send(phone, "We couldn't find that booking. Reply *hi* to start again.");
    return;
  }
  await MANAGE_SESSION.updateManageSession(phone, {
    stage: "RESCHEDULE_PICK_DATE",
    selectedBookingId: bookingId,
  });
  await sendList(
    phone,
    `*Moving ${booking.service?.name ?? "your booking"}*\n\nCurrently ${longWhen(booking.startsAt)}.\n\nWhich day suits you better?`,
    "Pick a day",
    dateRows(booking.timezone),
    "Next 10 days",
  );
}

export async function pickRescheduleDate(phone: string, date: string): Promise<void> {
  const session = await MANAGE_SESSION.getManageSession(phone);
  if (!(await requireToken(phone, session))) return;
  const booking = session?.selectedBookingId ? findBooking(session, session.selectedBookingId) : undefined;
  if (!booking?.service) {
    await send(phone, "We couldn't find that booking. Reply *hi* to start again.");
    return;
  }

  // Keep the customer with the stylist they already booked.
  const search = await SCHEDULER.searchSlots(booking.service.id, date, booking.staff?.id);
  if (!search.success || !search.data) {
    await send(phone, `We couldn't load times for that day. ${search.error ?? ""}`.trim());
    return;
  }
  if (!search.data.slots.length) {
    await sendList(
      phone,
      "Fully booked that day. Please pick another.",
      "Pick a day",
      dateRows(booking.timezone),
      "Next 10 days",
    );
    return;
  }

  await MANAGE_SESSION.updateManageSession(phone, { stage: "RESCHEDULE_PICK_TIME", selectedDate: date });
  const rows = search.data.slots.map<ActionSectionRows>((slot) => ({
    id: `${MANAGE_REPLY_PREFIX.time}${slot.start}`,
    title: new Intl.DateTimeFormat("en-GB", {
      timeZone: search.data!.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(slot.start)),
  }));
  await sendList(
    phone,
    `*Available times*\n\n${rows.length > MAX_ROWS ? `Showing the first ${MAX_ROWS}. ` : ""}Pick the one that suits you.`,
    "Pick a time",
    rows,
    "Times",
  );
}

export async function pickRescheduleTime(phone: string, slotStart: string): Promise<void> {
  const session = await MANAGE_SESSION.getManageSession(phone);
  const token = await requireToken(phone, session);
  if (!token || !session?.selectedBookingId) return;

  const moved = await SCHEDULER.rescheduleBooking(session.selectedBookingId, token, slotStart);
  if (!moved.success || !moved.data) {
    await send(
      phone,
      moved.code === "SLOT_UNAVAILABLE"
        ? "Someone just took that time. Reply *hi* and try again with another."
        : `We couldn't move that booking. ${moved.error ?? ""}`.trim(),
    );
    return;
  }
  await MANAGE_SESSION.clearManageSession(phone);
  logger.info(`${TAG} Rescheduled ${session.selectedBookingId} for ${phone}`);
  await send(
    phone,
    `*Booking moved!* ✨\n\nYou're now booked for *${longWhen(moved.data.startsAt)}*.\n\nWe'll remind you before it.`,
  );
}

const MANAGE_BOOKING = {
  startManageBookings,
  handleOtpReply,
  startCancel,
  confirmCancel,
  keepBooking,
  startReschedule,
  pickRescheduleDate,
  pickRescheduleTime,
};

export default MANAGE_BOOKING;
