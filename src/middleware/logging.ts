import { RequestHandler } from "express";

/** Wrap async controller → forwards any rejection to Express error middleware */
export const controller =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    const startTime = Date.now();
    const method = req.method;
    const url = req.originalUrl;
    
    // Show API payloads if enabled
    if (process.env.SHOW_API_PAYLOADS === 'true') {
      if (req.body && Object.keys(req.body).length > 0) {
        console.log(`\x1b[34m[PAYLOAD]\x1b[0m ${method} ${url} - Request:`, JSON.stringify(req.body, null, 2));
      }
      if (req.params && Object.keys(req.params).length > 0) {
        console.log(`\x1b[34m[PAYLOAD]\x1b[0m ${method} ${url} - Params:`, JSON.stringify(req.params, null, 2));
      }
      if (req.query && Object.keys(req.query).length > 0) {
        console.log(`\x1b[34m[PAYLOAD]\x1b[0m ${method} ${url} - Query:`, JSON.stringify(req.query, null, 2));
      }
    }
    
    // Wrap the controller execution in a promise
    Promise.resolve(fn(req, res, next))
      .then(() => {
        const duration = Date.now() - startTime;
        // Skip if API logging is muted
        if (process.env.MUTE_API_LOGS !== 'true') {
          console.log(`\x1b[32m[API]\x1b[0m ${method} ${url} - ${duration}ms`);
        }
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        // Skip if API error logging is muted
        if (process.env.MUTE_API_LOGS !== 'true') {
          console.error(`\x1b[33m[API ERROR]\x1b[0m ${method} ${url} - Error (${duration}ms): ${error.message}`);
        }
        next(error);
      });
  };