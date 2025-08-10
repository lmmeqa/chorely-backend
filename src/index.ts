/**
 * Application entry‐point.
 *  • Creates the Express app
 *  • Attaches middleware (cors, body-parser-json)
 *  • Mounts API routes under /chores
 *  • Starts HTTP server
 */
import express from "express";
import cors from "cors";
import choreRoutes from "./routes/choreRoutes";
import userRoutes  from "./routes/userRoutes";
import homeRoutes from "./routes/homeRoutes";
import approvalRoutes from "./routes/approvalRoutes";
import pointsRoutes from "./routes/pointsRoutes";
import disputeRoutes from "./routes/disputeRoutes";
import disputeVoteRoutes from "./routes/disputeVoteRoutes";
import activityRoutes from "./routes/activityRoutes";
import todoRoutes from "./routes/todoRoutes";
import { errorHandler } from "./middleware";
import { DisputeTimeoutService } from "./services/disputeTimeoutService";


const app = express();

// ─────── Global middleware ───────
app.use(cors());           // allow cross-origin frontend <-> API
app.use(express.json());   // parse JSON bodies into req.body

// ─────── Feature routers ───────
app.use("/chores", choreRoutes);  // all chore endpoints
app.use("/user", userRoutes);  // all user endpoints
app.use("/homes",  homeRoutes); // all home endpoints
app.use("/approvals", approvalRoutes);
app.use("/points", pointsRoutes);
app.use("/disputes", disputeRoutes);
app.use("/dispute-votes", disputeVoteRoutes);
app.use("/activities", activityRoutes);
app.use("/todos", todoRoutes);

/** last middleware: converts every error into JSON */
app.use(errorHandler);



// ─────── Boot HTTP server ───────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\x1b[35m[SERVER]\x1b[0m API ready on http://localhost:${PORT}`);
  console.log(`\x1b[35m[SERVER]\x1b[0m Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\x1b[35m[SERVER]\x1b[0m Database: ${process.env.DB_HOST || 'db'}:${process.env.DB_PORT || '5432'}`);
  
  // Start dispute timeout service
  DisputeTimeoutService.startTimeoutService();
  console.log(`\x1b[35m[SERVER]\x1b[0m Dispute timeout service started`);
});
