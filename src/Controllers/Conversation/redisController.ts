import { redisClient } from "../../services/redis";
import { logger } from "../../services/logger";

const thirtyMinutes = 1800; 

export const setRedisKeyValuePair = async (
  clientNumber: string,
  key: string,
  value: string,
) => {
  try {
    await redisClient.hSet(clientNumber, key, value);
    await redisClient.expire(clientNumber, thirtyMinutes);
    logger.silly(`${key} set to ${value} for ${clientNumber}`);
  } catch (error) {
    logger.error(`Error setting ${key} to${value}: ${error}`);
  }
};

export const deleteRedisKeyPair = async (clientNumber: string, key: string) => {
  try {
    await redisClient.hDel(clientNumber, key);
    logger.silly(`${clientNumber}:${key} deleted successfuly`);
  } catch (error) {
    logger.error(`error Deleting ${clientNumber} Key ${key}: ${error}`);
  }
};

export const getRedisKeyValue = async (clientNumber: string, key: string) => {
  try {
    const value = await redisClient.hGet(clientNumber, key);

    return value;
  } catch (error) {
    logger.error("Error fetchting stage from  Redis:", error);
  }
};
