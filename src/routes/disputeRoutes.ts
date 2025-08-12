import { Router } from "express";
import { list, create, approve, reject, getById, disputeUpload } from "../controllers/disputeController";

const r = Router();

r.get("/", list);                        // GET    /disputes?status=pending
r.get("/:uuid", getById);                // GET    /disputes/:uuid
r.post("/", disputeUpload.single('image'), create);                     // multipart: image optional
r.patch("/:uuid/approve", approve);      // PATCH  /disputes/:uuid/approve
r.patch("/:uuid/reject", reject);        // PATCH  /disputes/:uuid/reject

export default r;