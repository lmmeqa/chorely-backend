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
import { verifySupabaseToken } from "../middleware/supabaseAuth";
import { requireHomeMemberByParam, requireHomeMemberByQuery, requireHomeMemberByChoreUuidParam } from "../middleware/authorization";

const r = Router();

r.use(verifySupabaseToken);

r.post("/", createChore);                       // POST /chores

r.get("/available/:homeId", requireHomeMemberByParam("homeId"), listAvailable);
r.get("/unapproved/:homeId", requireHomeMemberByParam("homeId"), listUnapproved);
r.get("/user", requireHomeMemberByQuery("homeId"), listUserChores);

r.patch("/:uuid/approve", approveChore);       // PATCH /chores/:uuid/approve
r.patch("/:uuid/claim", claimChore);         // PATCH /chores/:uuid/claim
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Configure multer to preserve file extensions
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    // Generate a unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg'; // Default to .jpg if no extension
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});
r.patch("/:uuid/complete", requireHomeMemberByChoreUuidParam("uuid"), upload.single('image'), completeChore);
r.patch("/:uuid/verify", (req, res) => {      // PATCH /chores/:uuid/verify (DEPRECATED)
  res.status(410).json({
    error: "The /verify endpoint has been deprecated. Please use /complete instead.",
    message: "Use PATCH /chores/:uuid/complete to complete a chore"
  });
});
r.get("/:uuid", getById);                 // GET /chores/:uuid
export default r;
