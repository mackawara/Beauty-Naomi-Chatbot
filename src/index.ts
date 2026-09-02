import express, { Request, Response } from "express";
import { logger } from "./services/logger";
import { CONFIG } from "./config";
import cors from "cors";
import { connectDb } from "./services/db";
import router from "./routes/whatsappRoutes";
import { RedisService } from "./services/redis";
import schedulerRoutes from "./routes/schedulerRoutes";
import { schedulerCheckLive, schedulerCheckReady } from "./services/schedulerService";

const app = express();
app.use(cors());
app.use(express.json());
app.use(schedulerRoutes);
app.use("/whatsapp", router);

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Server running and working",
  });
  
});

Promise.race([
  RedisService.getInstance().connect(),
  new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("Failed to connect to Redis: Timeout exceeded"));
    }, CONFIG.REDIS_CONNECT_TIMEOUT);
  }),
])

  .then(async () => {
    await connectDb();

    //checking if the scheduler API is live and ready
    logger.info("Checking if the scheduler API is live and ready...");
    const schedulerLiveStatus = await schedulerCheckLive();
    if (schedulerLiveStatus.status !== "live") {
      logger.error("Scheduler API is not live");
      process.exit(1);
    }
    const schedulerReadyStatus = await schedulerCheckReady();
    if (schedulerReadyStatus.status !== "ready") {
      logger.error("Scheduler API is not ready");
      process.exit(1);
    }

    app.listen(CONFIG.PORT, () => {
      logger.info(`Server running on port ${CONFIG.PORT}`);
    });

  })
  .catch((error: any) => {
    logger.error(error);
    process.exit(1);
  });
