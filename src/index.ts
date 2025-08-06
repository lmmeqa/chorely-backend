/**
 * Application entry‐point.
 *  • Creates the Express app
 *  • Attaches middleware (cors, body-parser-json)
 *  • Mounts API routes under /chores
 *  • Starts HTTP server
 */
import { Request, Response, NextFunction } from "express";

import express from "express";
import cors from "cors";
import { router as choreRoutes } from "./routes/choreRoutes";
import userRoutes  from "./routes/userRoutes";
import { DatabaseError } from "pg";

const app = express();

// ─────── Global middleware ───────
app.use(cors());           // allow cross-origin frontend <-> API
app.use(express.json());   // parse JSON bodies into req.body

// ─────── Feature routers ───────
app.use("/chores", choreRoutes);  // all chore endpoints
app.use("/user", userRoutes);  // all user endpoints


/** last middleware: converts every error into JSON */
app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // default response
    let status = 500;
    let message = "Unexpected server error";

    if (err instanceof Error) {
      // map well-known Postgres SQLSTATE codes
      const code = (err as DatabaseError | { code?: string }).code;
      switch (code) {
        case "23505": // unique_violation
          status = 409;
          message = "Resource already exists";
          break;
        case "23503": // foreign_key_violation
          status = 400;
          message = "Related record not found";
          break;
        default:
          message = err.message; // any other error
      }
    }

    res.status(status).json({ error: message });
  }
);



// ─────── Boot HTTP server ───────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));
