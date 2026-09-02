import axios from 'axios';
import { CONFIG } from '../config';
import { logger } from '../services/logger';


// check the health of the scheduler API
export const schedulerCheckLive = async () => {
  try {
    const response = await axios.get(`${CONFIG.SCHEDULER_API_URL}/health/live`, {
      timeout: CONFIG.SCHEDULER_API_TIMEOUT,
    });
    logger.info('Scheduler API Status live check:', response.data);
    return {
      message: "Scheduler API status received successfully",
      status:"live",
      data: response.data
    };
  } catch (error: any) {
    logger.error('Error checking scheduler health:', error);
    return {
      message: "Error checking scheduler health",
      status:"down",
      data: error.message
    };
  }
}

//check if the scheduler is ready
export const schedulerCheckReady = async () => {
  try {
    const response = await axios.get(`${CONFIG.SCHEDULER_API_URL}/health/ready`, {
      timeout: CONFIG.SCHEDULER_API_TIMEOUT,
    });
    logger.info('Scheduler API Status ready check:', response.data);
    return {
      message: "Scheduler API readiness check received successfully",
      status: "ready",
      data: response.data
    };
  } catch (error: any) {
    logger.error('Error checking scheduler readiness:', error);
    return {
      message: "Error checking scheduler readiness",
      status: "not ready",
      data: error.message
    };
  }
}
