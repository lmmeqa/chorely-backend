import { Router } from "express";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getById,
  createChore,
  listAvailable,
  listUnapproved,
  listUserChores,
  approveChore,
  claimChore,
  completeChore,
} from "../controllers/choreController";

const r = Router();

r.post("/", createChore);                       // POST /chores

r.get("/available/:homeId",  listAvailable);    // GET /chores/available/:homeId
r.get("/unapproved/:homeId", listUnapproved);   // GET /chores/unapproved/:homeId
r.get("/user", listUserChores);   // GET /chores/user/:email?status=a,b

  r.patch("/:uuid/approve",  approveChore);       // PATCH /chores/:uuid/approve
  r.patch("/:uuid/claim",    claimChore);         // PATCH /chores/:uuid/claim
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const upload = multer({ dest: uploadDir, limits: { fileSize: 10 * 1024 * 1024 } });
  r.patch("/:uuid/complete", upload.single('image'), completeChore);      // PATCH /chores/:uuid/complete
  r.patch("/:uuid/verify",   (req, res) => {      // PATCH /chores/:uuid/verify (DEPRECATED)
    res.status(410).json({
      error: "The /verify endpoint has been deprecated. Please use /complete instead.",
      message: "Use PATCH /chores/:uuid/complete to complete a chore"
    });
  });
  r.get("/:uuid", getById);                 // GET /chores/:uuid
export default r;
