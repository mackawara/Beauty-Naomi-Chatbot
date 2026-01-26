import mongoose from "mongoose";
import { CONFIG } from "../config";


export const connectDb = (async () => {
  try {

    const mongoString = 'mongodb+srv://{MONGODB_USERNAME}:{MONGODB_PASSWORD}@{MONGODB_HOST}'

    const connectionString =
      `mongodb+srv://${CONFIG.MONGODB_USERNAME}:${CONFIG.MONGODB_PASSWORD}@${CONFIG.MONGODB_HOST}`;
    console.log(`[MONGOOSE]: Connecting: ${mongoString} `);

    const _db = await mongoose.connect(connectionString);
    console.log("[MONGOOSE] Database connected successfully");
    if (process.env.DB_DEBUG === "true") {
      console.log(
        "Enabling mongoose debug mode. Disable it by not setting DB_DEBUG in your .env",
      );
      mongoose.set("debug", true);
    }
    return _db;
  } catch (error) {
    console.error("Failed Database Connection", error);
    process.exit(1);
  }
});


