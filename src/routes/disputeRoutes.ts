import { Router } from "express";
import { list, create, sustain, overrule, getById, disputeUpload } from "../controllers/disputeController";

const r = Router();

r.get("/", list);                        // GET    /disputes?status=pending
r.get("/:uuid", getById);                // GET    /disputes/:uuid
r.post("/", disputeUpload.single('image'), create);                     // multipart: image optional
r.patch("/:uuid/sustain", sustain);      // PATCH  /disputes/:uuid/sustain
r.patch("/:uuid/overrule", overrule);    // PATCH  /disputes/:uuid/overrule

export default r;