import { Router } from "express";
import { list, create, approve, reject } from "../controllers/disputeController";

const r = Router();

r.get("/", list);                        // GET    /disputes?status=pending
r.post("/", create);                     // POST   /disputes { choreId, reason, imageUrl, disputerEmail }
r.patch("/:uuid/approve", approve);      // PATCH  /disputes/:uuid/approve
r.patch("/:uuid/reject", reject);        // PATCH  /disputes/:uuid/reject

export default r;