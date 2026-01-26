import dotenv from "dotenv";

dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || 4000,
  MONGODB_PASSWORD: process.env.MONGODB_PASSWORD,
  MONGODB_USERNAME: process.env.MONGODB_USERNAME,
  MONGODB_HOST: process.env.MONGODB_HOST,
};
