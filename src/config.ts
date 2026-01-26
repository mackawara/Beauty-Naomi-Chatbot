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
  WHATSAPP_WEBHOOK_VERIFICATION_TOKEN= whatsapp_verification_token
  ...
  `,
  );

  process.exit(1);
}

export const CONFIG = {
  IS_LOCAL_ENVIRONMENT: process.env.APP_ENV !== "production",
  PORT: parseInt(process.env.PORT || "0", 10) || 4000,
  MONGODB_HOST: process.env.MONGODB_HOST || "0.0.0.0",
  MONGODB_PASSWORD: process.env.MONGODB_PASSWORD || "",
  MONGODB_USERNAME: process.env.MONGODB_USERNAME || "",
  WHATSAPP_WEBHOOK_VERIFICATION_TOKEN:
    process.env.WHATSAPP_WEBHOOK_VERIFICATION_TOKEN || "",
};
logger.warn(
  `[${TAG}] Running in ${CONFIG.IS_LOCAL_ENVIRONMENT ? "LOCAL" : "PRODUCTION"} environment`,
);
