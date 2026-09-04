import { randomUUID } from "crypto";
import { RedisService } from "./redis";
import { logger } from "./logger";

const TAG = "[FLOW-SESSION]";
const KEY_PREFIX = "flow:booking:";
/** Long enough for someone to browse and fill the form, short enough to expire abandoned attempts. */
const TTL_SECONDS = 60 * 60;

export interface BookingFlowSession {
  /** WhatsApp number that opened the Flow. Meta never sends it in the payload. */
  phone: string;
  customerName?: string;
  serviceId?: string;
  serviceName?: string;
  date?: string;
  slotStartTime?: string;
  staffId?: string;
  holdId?: string;
  /**
   * Stable per attempt so a retried submission or a re-delivered Flow request
   * cannot create a second appointment.
   */
  idempotencyKey: string;
}

function key(flowToken: string): string {
  return `${KEY_PREFIX}${flowToken}`;
}

export function newFlowToken(): string {
  return `booking-${randomUUID()}`;
}

export async function createSession(flowToken: string, phone: string): Promise<BookingFlowSession> {
  const session: BookingFlowSession = { phone, idempotencyKey: `wa-${flowToken}` };
  await saveSession(flowToken, session);
  return session;
}

export async function getSession(flowToken: string): Promise<BookingFlowSession | null> {
  try {
    const raw = await RedisService.getInstance().getClient().get(key(flowToken));
    return raw ? (JSON.parse(raw) as BookingFlowSession) : null;
  } catch (error) {
    logger.error(`${TAG} Could not read the flow session`, error);
    return null;
  }
}

export async function saveSession(flowToken: string, session: BookingFlowSession): Promise<void> {
  try {
    await RedisService.getInstance()
      .getClient()
      .set(key(flowToken), JSON.stringify(session), { expiration: { type: "EX", value: TTL_SECONDS } });
  } catch (error) {
    logger.error(`${TAG} Could not save the flow session`, error);
  }
}

export async function updateSession(
  flowToken: string,
  patch: Partial<BookingFlowSession>,
): Promise<BookingFlowSession | null> {
  const existing = await getSession(flowToken);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await saveSession(flowToken, updated);
  return updated;
}

export async function clearSession(flowToken: string): Promise<void> {
  try {
    await RedisService.getInstance().getClient().del(key(flowToken));
  } catch (error) {
    logger.error(`${TAG} Could not clear the flow session`, error);
  }
}

const FLOW_SESSION = {
  newFlowToken,
  createSession,
  getSession,
  saveSession,
  updateSession,
  clearSession,
};

export default FLOW_SESSION;
