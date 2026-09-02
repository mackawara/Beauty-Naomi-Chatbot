import { schedulerCheckLive, schedulerCheckReady } from "../services/schedulerService";
import {Request, Response} from "express";


// check the health of the scheduler API
export const apiHealthCheck = async (req: Request, res: Response) => {
  const result = await schedulerCheckLive();
  if (result.status === "live") {
    res.json(result);
  } else {  
    res.status(500).json(result);
  }

}

//check if the scheduler is ready
export const apiHealthCheckReady = async (req: Request, res: Response) => {
  const result = await schedulerCheckReady();
  if (result.status === "ready") {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
}
