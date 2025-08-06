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

const app = express();

// ─────── Global middleware ───────
app.use(cors());           // allow cross-origin frontend <-> API
app.use(express.json());   // parse JSON bodies into req.body


app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal error";
  res.status(400).json({ error: message });
});

// ─────── Feature routers ───────
app.use("/chores", choreRoutes);  // all chore endpoints
app.use("/user", userRoutes);  // all user endpoints

// ─────── Boot HTTP server ───────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));
