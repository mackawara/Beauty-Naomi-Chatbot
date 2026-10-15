import { FlowHandler, FlowRequest, FlowResponse } from "../../../types/flows";

const handlers = new Map<string, FlowHandler>();

/**
 * Register a handler for a Flow action. Keys are matched most-specific first:
 * "data_exchange:<SCREEN>:<trigger>", then "<action>:<SCREEN>", then "<action>".
 * The trigger is the `trigger` field our Flow JSON puts in each data_exchange payload.
 */
export const registerFlowHandler = (key: string, handler: FlowHandler) => {
  handlers.set(key, handler);
};

export const routeFlowRequest = async (request: FlowRequest): Promise<FlowResponse> => {
  const trigger = typeof request.data?.trigger === "string" ? request.data.trigger : undefined;
  const candidates = [
    trigger && `${request.action}:${request.screen}:${trigger}`,
    request.screen && `${request.action}:${request.screen}`,
    request.action,
  ].filter((key): key is string => Boolean(key));
  for (const key of candidates) {
    const handler = handlers.get(key);
    if (handler) {
      return handler(request);
    }
  }
  throw new Error(`No Flow handler for ${candidates[0]}`);
};
