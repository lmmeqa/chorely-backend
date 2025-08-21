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
import authRoutes from "./routes/authRoutes";
import { errorHandler } from "./middleware";
import path from "path";
import fs from "fs";

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Global middleware
app.use(cors());
app.use(express.json());

// Static files
app.use('/uploads', (req, res, next) => {
  next();
}, express.static(uploadsDir, {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

app.use('/seed', (req, res, next) => {
  next();
}, express.static(path.join(__dirname, '..', 'static', 'seed'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// Feature routers
app.use("/chores", choreRoutes);
app.use("/user", userRoutes);
app.use("/homes",  homeRoutes);
app.use("/approvals", approvalRoutes);
app.use("/points", pointsRoutes);
app.use("/disputes", disputeRoutes);
app.use("/dispute-votes", disputeVoteRoutes);
app.use("/activities", activityRoutes);
app.use("/todos", todoRoutes);
app.use("/auth", authRoutes);

// Error handler
app.use(errorHandler);

export default app;


