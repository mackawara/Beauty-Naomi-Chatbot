import * as dotenv from "dotenv";
import path from "path";

import { logger } from "./services/logger";
dotenv.config({ path: path.join(__dirname, "../.env") });

const TAG = "CONFIG";

const mandatoryEnvironmentConstants = [
  "APP_ENV",
  "PORT",
  "MONGODB_PASSWORD",
  "MONGODB_USERNAME",
  "MONGODB_HOST",
  "WHATSAPP_WEBHOOK_VERIFICATION_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_SYSTEM_TOKEN",
  "SCHEDULER_API_URL",
  "SCHEDULER_API_KEY",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_FLOW_PRIVATE_KEY",
  "WHATSAPP_BOOKING_FLOW_ID",
  "SCHEDULER_WEBHOOK_SECRET",
];

const missingEnvironmentVariables = mandatoryEnvironmentConstants.filter(
  (constant) => !process.env[constant],
);

if (missingEnvironmentVariables.length > 0) {
  const constantsString = JSON.stringify(missingEnvironmentVariables);

  logger.info(
    `[${TAG}] Environment variable(s) ${constantsString.substring(
      1,
      constantsString.length - 1,
    )} required. If running on local server, create a .env file in the root folder and define them in that file like: 
      
  MONGODB_USERNAME=username
  MONGODB_PASSWORD=password
  MONGODB_DATABASE_HOST=cluster_path/database_name
  ...
  `,
  );

  process.exit(1);
}

export const CONFIG = {
  IS_LOCAL_ENVIRONMENT: process.env.APP_ENV || false,
  PORT: parseInt(process.env.PORT || "0", 10) || 4000,
  MONGODB_HOST: process.env.MONGODB_HOST || "0.0.0.0",
  MONGODB_PASSWORD: process.env.MONGODB_PASSWORD || "",
  MONGODB_USERNAME: process.env.MONGODB_USERNAME || "",
  WHATSAPP_WEBHOOK_VERIFICATION_TOKEN:
    process.env.WHATSAPP_WEBHOOK_VERIFICATION_TOKEN || "",
  REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",
  REDIS_HOST_PORT: process.env.REDIS_HOST_PORT
    ? parseInt(process.env.REDIS_HOST_PORT)
    : 6379,
  REDIS_CONNECT_TIMEOUT:
    parseInt(process.env.REDIS_CONNECT_TIMEOUT || "0", 10) || 90000,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  WHATSAPP_SYSTEM_TOKEN: process.env.WHATSAPP_SYSTEM_TOKEN || "",
  CATALOG_ID: process.env.CATALOG_ID || "",
  SCHEDULER_API_KEY: process.env.SCHEDULER_API_KEY || "",
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || "",
  WHATSAPP_FLOW_PRIVATE_KEY: process.env.WHATSAPP_FLOW_PRIVATE_KEY || "",
  WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE: process.env.WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE || "",
  WHATSAPP_BOOKING_FLOW_ID: process.env.WHATSAPP_BOOKING_FLOW_ID || "",
  SCHEDULER_WEBHOOK_SECRET: process.env.SCHEDULER_WEBHOOK_SECRET || "",
  WHATSAPP_TEMPLATE_LANGUAGE: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US",
  WHATSAPP_TEMPLATE_REMINDER: process.env.WHATSAPP_TEMPLATE_REMINDER || "booking_reminder",
  WHATSAPP_TEMPLATE_CANCELLED: process.env.WHATSAPP_TEMPLATE_CANCELLED || "booking_cancelled",
  WHATSAPP_TEMPLATE_RESCHEDULED: process.env.WHATSAPP_TEMPLATE_RESCHEDULED || "booking_rescheduled",
  SCHEDULER_API_URL: process.env.SCHEDULER_API_URL || "http://localhost:4100",
  SCHEDULER_API_TIMEOUT: parseInt(process.env.SCHEDULER_API_TIMEOUT || "0", 10) || 5000,
};
logger.warn(
  `[${TAG}] Running in ${CONFIG.IS_LOCAL_ENVIRONMENT ? "LOCAL" : "PRODUCTION"} environment`,
);
 