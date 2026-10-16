// WhatsApp Flows data endpoint payloads
// https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint

export interface EncryptedFlowRequest {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
}

export type FlowAction = "ping" | "INIT" | "data_exchange" | "BACK";

export interface FlowRequest {
  version: string;
  action: FlowAction;
  screen?: string;
  data?: Record<string, unknown> & { error?: string; error_message?: string };
  flow_token?: string;
}

export interface FlowScreenResponse {
  screen: string;
  data: Record<string, unknown>;
}

export type FlowResponse = FlowScreenResponse | { data: Record<string, unknown> };

export type FlowHandler = (request: FlowRequest) => Promise<FlowResponse>;
