import { Router } from 'express';
import { apiHealthCheck, apiHealthCheckReady } from '../schedulerController/schedulerHealth.controller';

const schedulerRoutes = Router();

schedulerRoutes.get('/health/live', apiHealthCheck);
schedulerRoutes.get('/health/ready', apiHealthCheckReady);

export default schedulerRoutes;