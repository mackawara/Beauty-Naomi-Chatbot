import express, { Request, Response } from "express";
import { logger } from "./services/logger";
import { CONFIG } from "./config";
import cors from "cors";
import { connectDb } from "./services/db";
import router from "./routes/whatsappRoutes";
import schedulerRouter from "./routes/schedulerRoutes";
import { RedisService } from "./services/redis";

const app = express();
app.use(cors());
app.use(
  express.json({
    // The scheduler signs the exact bytes it sent, so the raw body is kept for
    // signature verification before the parsed body is used.
    verify: (req, _res, buffer) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buffer;
    },
  }),
);

app.use("/whatsapp", router);
app.use("/scheduler", schedulerRouter);

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

    app.listen(CONFIG.PORT, () => {
      logger.info(`Server running on port ${CONFIG.PORT}`);
    });
  })
  .catch((error: any) => {
    logger.error(error);
    process.exit(1);
  });
