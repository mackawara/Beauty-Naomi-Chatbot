import "express";

declare global {
  namespace Express {
    interface Request {
      /** Raw request body, captured for webhook signature checks. */
      rawBody?: Buffer;
    }
  }
}
