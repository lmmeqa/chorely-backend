import { Router } from "express";
import { list, create, getById } from "../controllers/disputeController";

const r = Router();

r.get("/", list);                        // GET    /disputes?status=pending
r.get("/:uuid", getById);                // GET    /disputes/:uuid
r.post("/", create);                     // POST   /disputes { choreId, reason, imageUrl, disputerEmail }

// Note: approve and reject endpoints have been removed
// Use /dispute-votes endpoints for voting on disputes

export default r;