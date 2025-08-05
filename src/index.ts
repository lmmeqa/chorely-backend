/**
 * Application entry‐point.
 *  • Creates the Express app
 *  • Attaches middleware (cors, body-parser-json)
 *  • Mounts API routes under /chores
 *  • Starts HTTP server
 */

import express from "express";
import { Request, Response, NextFunction } from "express";

import cors from "cors";
import { router as choreRoutes } from "./routes/choreRoutes";

const app = express();

// ─────── Global middleware ───────
app.use(cors());           // allow cross-origin frontend <-> API
app.use(express.json());   // parse JSON bodies into req.body


// ─────── Feature routers ───────
app.use("/chores", choreRoutes);  // all chore endpoints

// ─────── Boot HTTP server ───────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));
