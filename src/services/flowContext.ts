import { randomUUID } from "crypto";
import { redisClient } from "./redis";

/** What the bot knows about a booking Flow it sent, keyed by the Flow's flow_token. */
export interface BookingFlowContext {
  phone: string;
  serviceId: string;
  serviceName: string;
  serviceDetails: string;
  bookingId: string;
  customerName?: string;
}

const FLOW_CONTEXT_TTL_SECONDS = 60 * 60;
const key = (flowToken: string) => `flow:${flowToken}`;

export interface FlowContextStore {
  get(flowToken: string): Promise<BookingFlowContext | null>;
  delete(flowToken: string): Promise<void>;
}

/** Stores the context and returns a new flow_token for it (expires after an hour). */
export const createFlowContext = async (context: BookingFlowContext): Promise<string> => {
  const flowToken = randomUUID();
  await redisClient.set(key(flowToken), JSON.stringify(context), { EX: FLOW_CONTEXT_TTL_SECONDS });
  return flowToken;
};

export const redisFlowContextStore: FlowContextStore = {
  async get(flowToken) {
    const value = await redisClient.get(key(flowToken));
    return value ? (JSON.parse(value) as BookingFlowContext) : null;
  },
  async delete(flowToken) {
    await redisClient.del(key(flowToken));
  },
};
