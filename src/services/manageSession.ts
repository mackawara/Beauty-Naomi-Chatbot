import { RedisService } from "./redis";
import { logger } from "./logger";
import type { TSchedulerCustomerBooking } from "../types/types";

const TAG = "[MANAGE-SESSION]";
const KEY_PREFIX = "manage:booking:";
const TTL_SECONDS = 30 * 60;

export type ManageStage =
  | "AWAITING_OTP"
  | "READY"
  | "AWAITING_CANCEL_CONFIRM"
  | "RESCHEDULE_PICK_DATE"
  | "RESCHEDULE_PICK_TIME";

export interface ManageSession {
  stage: ManageStage;
  /** Customer-scoped scheduler token, valid for 30 minutes after verification. */
  accessToken?: string;
  tokenExpiresAt?: number;
  bookings?: TSchedulerCustomerBooking[];
  selectedBookingId?: string;
  selectedDate?: string;
  otpAttempts?: number;
}

function key(phone: string): string {
  return `${KEY_PREFIX}${phone}`;
}

export async function getManageSession(phone: string): Promise<ManageSession | null> {
  try {
    const raw = await RedisService.getInstance().getClient().get(key(phone));
    if (!raw) return null;
    const session = JSON.parse(raw) as ManageSession;
    // An expired scheduler token is worse than none: it makes every action fail
    // with a confusing error instead of asking for a fresh code.
    if (session.accessToken && (session.tokenExpiresAt ?? 0) <= Date.now()) {
      return { ...session, stage: "AWAITING_OTP", accessToken: undefined, tokenExpiresAt: undefined };
    }
    return session;
  } catch (error) {
    logger.error(`${TAG} Could not read the manage session`, error);
    return null;
  }
}

export async function saveManageSession(phone: string, session: ManageSession): Promise<void> {
  try {
    await RedisService.getInstance()
      .getClient()
      .set(key(phone), JSON.stringify(session), { expiration: { type: "EX", value: TTL_SECONDS } });
  } catch (error) {
    logger.error(`${TAG} Could not save the manage session`, error);
  }
}

export async function updateManageSession(
  phone: string,
  patch: Partial<ManageSession>,
): Promise<ManageSession | null> {
  const existing = (await getManageSession(phone)) ?? { stage: "AWAITING_OTP" as ManageStage };
  const updated = { ...existing, ...patch };
  await saveManageSession(phone, updated);
  return updated;
}

export async function clearManageSession(phone: string): Promise<void> {
  try {
    await RedisService.getInstance().getClient().del(key(phone));
  } catch (error) {
    logger.error(`${TAG} Could not clear the manage session`, error);
  }
}

const MANAGE_SESSION = {
  getManageSession,
  saveManageSession,
  updateManageSession,
  clearManageSession,
};

export default MANAGE_SESSION;
