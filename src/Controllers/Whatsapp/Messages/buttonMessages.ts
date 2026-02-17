import { BUTTONS_REPLY_ID } from "../../../constants/whatsapp";
import { ReplyButtonObject } from "../../../types/types";

export const CONTINUE_BUTTON: ReplyButtonObject = {
  type: "reply",
  reply: {
    id: BUTTONS_REPLY_ID.continue,
    title: "Continue",
  },
};
