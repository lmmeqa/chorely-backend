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
import path from "path";
import fs from "fs";


const app = express();

// ─────── Ensure uploads directory exists ───────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─────── Global middleware ───────
app.use(cors());           // allow cross-origin frontend <-> API
app.use(express.json());   // parse JSON bodies into req.body
// Serve static files with caching headers and logging
app.use('/uploads', (req, res, next) => {
  const start = Date.now();
  console.log(`\x1b[36m[STATIC]\x1b[0m Upload file accessed: ${req.path}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`\x1b[36m[STATIC]\x1b[0m Upload file served: ${req.path} (${duration}ms)`);
  });
  
  next();
}, express.static(uploadsDir, {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true
}));

app.use('/seed', (req, res, next) => {
  const start = Date.now();
  console.log(`\x1b[36m[STATIC]\x1b[0m Seed file accessed: ${req.path}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`\x1b[36m[STATIC]\x1b[0m Seed file served: ${req.path} (${duration}ms)`);
  });
  
  next();
}, express.static(path.join(__dirname, '..', 'static', 'seed'), {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true
}));

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
const server = app.listen(PORT, () => {
  console.log(`\x1b[35m[SERVER]\x1b[0m API ready on http://localhost:${PORT}`);
  console.log(`\x1b[35m[SERVER]\x1b[0m Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\x1b[35m[SERVER]\x1b[0m Database: ${process.env.DB_HOST || 'db'}:${process.env.DB_PORT || '5432'}`);
  
  // Start dispute timeout service
  DisputeTimeoutService.startTimeoutService();
  console.log(`\x1b[35m[SERVER]\x1b[0m Dispute timeout service started`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  DisputeTimeoutService.stopTimeoutService();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  DisputeTimeoutService.stopTimeoutService();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
