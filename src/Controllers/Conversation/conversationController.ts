import { logger } from "../../services/logger";

const buttonReplyHandler = async() => {
  try {
    logger.info(`[BUTTON MESSAGE]: Received a Button Reply Message`);
    return;
  } catch (error) {
    logger.error(`[BUTTON MESSAGE]: Error on button reply message `, error);
    throw error;
  }
};

const listReplyHanlder = async() => {
  try {
    logger.info(`[LIST MESSAGE]: Received List Reply Message`);
    return;
  } catch (error) {
    logger.error(`[[LIST MESSAGE]: Error on list reply message `, error);
    throw error;
  }
};

const textReplyHandler = async() => {
  try {
    logger.info(`[TEXT MESSAGE]: Received Text Reply Message`);
    return;
  } catch (error) {
    logger.error(`[TEXT MESSAGE]: Error on text reply message `, error);
    throw error;
  }
};

const interactiveReplyHandler = async() => {
  try {
    logger.info(`[INTERACTIVE MESSAGE]: Received interactive Reply Message`);
    return;
  } catch (error) {
    logger.error(
      `[INTERACTIVE MESSAGE]: Error on interactive reply message `,
      error,
    );
    throw error;
  }
};

const CONVERSATION_CONTROLLER = {
  buttonReplyHandler,
  listReplyHanlder,
  interactiveReplyHandler,
  textReplyHandler,
};

export default CONVERSATION_CONTROLLER;
