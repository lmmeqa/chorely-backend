import { DatabaseError } from "pg";
import { ModelError } from "../db/models/ModelError";
import type { Context } from "hono";
import type { Request, Response, NextFunction } from "express";

/** Error handling middleware: converts every error into JSON */
export const errorHandler = (
  err: unknown, 
  reqOrC: Request | Context, 
  res?: Response, 
  _next?: NextFunction
) => {
  // Handle both Express and Hono contexts
  const isHono = 'req' in reqOrC;
  const c = isHono ? reqOrC : null;
  const req = isHono ? reqOrC.req : reqOrC;
  const resObj = isHono ? reqOrC : res;
  // Log the error with request details
  if (process.env.MUTE_ERROR_LOGS !== 'true') {
    const method = isHono ? req.method : req.method;
    const url = isHono ? req.url : (req as any).originalUrl || req.url;
    console.error(`\x1b[31m[ERROR]\x1b[0m ${method} ${url} - ${err instanceof Error ? err.message : String(err)}`);
  }

  // Handle ModelErrors (our custom error class)
  if (err instanceof ModelError) {
    if (isHono && c) {
      return c.json({
        error: err.message,
        code: err.code
      }, err.http as any);
    } else if (resObj) {
      return (resObj as Response).status(err.http).json({
        error: err.message,
        code: err.code
      });
    }
  }

  // Handle Postgres errors
  if (err instanceof Error) {
    const code = (err as DatabaseError | { code?: string }).code;
    const detail = (err as DatabaseError | { detail?: string }).detail;
    
    // Extract field and value from Postgres error detail
    const match = detail?.match(/Key \((.*?)\)=\((.*?)\)/);
    const field = match?.[1];
    const value = match?.[2];

    switch (code) {
      case "23505": // unique_violation
        if (isHono && c) {
          return c.json({
            error: `A record with ${field} '${value}' already exists`,
            code: "DUPLICATE"
          }, 409);
        } else if (resObj) {
          return (resObj as Response).status(409).json({
            error: `A record with ${field} '${value}' already exists`,
            code: "DUPLICATE"
          });
        }
        break;
      
      case "23503": // foreign_key_violation
        if (isHono && c) {
          return c.json({
            error: `Referenced ${field} '${value}' does not exist`,
            code: "NOT_FOUND"
          }, 404);
        } else if (resObj) {
          return (resObj as Response).status(404).json({
            error: `Referenced ${field} '${value}' does not exist`,
            code: "NOT_FOUND"
          });
        }
        break;
      
      default:
        // For any other error, use the error message if available
        if (isHono && c) {
          return c.json({
            error: err.message || "An unexpected error occurred",
            code: "SERVER_ERROR"
          }, 500);
        } else if (resObj) {
          return (resObj as Response).status(500).json({
            error: err.message || "An unexpected error occurred",
            code: "SERVER_ERROR"
          });
        }
    }
  }

  // For non-Error objects
  if (isHono && c) {
    return c.json({
      error: "An unexpected error occurred",
      code: "SERVER_ERROR"
    }, 500);
  } else if (resObj) {
    return (resObj as Response).status(500).json({
      error: "An unexpected error occurred",
      code: "SERVER_ERROR"
    });
  }
};