/**
 * Application entry‐point.
 *  • Creates the Express app
 *  • Attaches middleware (cors, body-parser-json)
 *  • Mounts API routes under /chores
 *  • Starts HTTP server
 */
import app from "./app";
import { DisputeTimeoutService } from "./services/disputeTimeoutService";



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
