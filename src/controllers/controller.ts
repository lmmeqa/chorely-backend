import { RequestHandler } from "express";

/** Wrap async controller → forwards any rejection to Express error middleware */
export const controller =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);