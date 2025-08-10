import { Request, Response, NextFunction } from "express";
import { DatabaseError } from "pg";
import { ModelError } from "../db/models/ModelError";

/** Error handling middleware: converts every error into JSON */
export const errorHandler = (
  err: unknown, 
  req: Request, 
  res: Response, 
  _next: NextFunction
) => {
  // Log the error with request details
  if (process.env.MUTE_ERROR_LOGS !== 'true') {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${req.method} ${req.originalUrl} - ${err instanceof Error ? err.message : String(err)}`);
  }

  // Handle ModelErrors (our custom error class)
  if (err instanceof ModelError) {
    return res.status(err.http).json({
      error: err.message,
      code: err.code
    });
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
        return res.status(409).json({
          error: `A record with ${field} '${value}' already exists`,
          code: "DUPLICATE"
        });
      
      case "23503": // foreign_key_violation
        return res.status(404).json({
          error: `Referenced ${field} '${value}' does not exist`,
          code: "NOT_FOUND"
        });
      
      default:
        // For any other error, use the error message if available
        return res.status(500).json({
          error: err.message || "An unexpected error occurred",
          code: "SERVER_ERROR"
        });
    }
  }

  // For non-Error objects
  res.status(500).json({
    error: "An unexpected error occurred",
    code: "SERVER_ERROR"
  });
};