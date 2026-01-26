import express, { Request, Response } from "express";
import { logger } from './services/logger';
import { CONFIG } from "./config";
import cors from "cors";
import { connectDb } from "./services/db";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Server running and working",
  });
});
connectDb()
  .then(async () => {
    app.listen(CONFIG.PORT, () => {
      console.log(`Server running on port ${CONFIG.PORT}`);
    });
  })
  .catch((error: any) => {
    console.error(error);
    process.exit(1);
  });
