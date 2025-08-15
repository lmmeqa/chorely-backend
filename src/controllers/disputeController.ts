import { controller } from "../middleware";
import { Dispute } from "../db/models";
import { db } from "../db/models";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

export const list = controller(async (req, res) => {
  const status = (req.query.status as string) as any;
  // Return enriched disputes with necessary chore fields to avoid N+1 on the client
  const q = db("disputes")
    .select(
      "disputes.uuid",
      "disputes.chore_id",
      "disputes.disputer_email",
      "disputes.reason",
      "disputes.image_url",
      "disputes.status",
      "disputes.created_at",
      "chores.name as chore_name",
      "chores.description as chore_description",
      "chores.icon as chore_icon",
      "chores.user_email as chore_user_email",
      "chores.photo_url as chore_photo_url",
      "chores.points as chore_points"
    )
    .leftJoin("chores", "chores.uuid", "disputes.chore_id")
    .orderBy("disputes.created_at", "desc");
  if (status) q.where("disputes.status", status);
  const rows = await q;
  res.json(rows);
});

export const getById = controller(async (req, res) => {
  const dispute = await Dispute.findByUuid(req.params.uuid);
  if (!dispute) {
    return res.status(404).json({ error: "Dispute not found" });
  }
  res.json(dispute);
});

// Multer setup for dispute image uploads
const uploadDir = path.join(process.cwd(), "uploads");
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

export const disputeUpload = multer({ 
  storage: storage, 
  limits: { fileSize: 10 * 1024 * 1024 } 
});

export const create = controller(async (req, res) => {
  const { choreId, reason, disputerEmail } = req.body;
  const file = (req as any).file as any;
  const photoUrl = file ? `/uploads/${file.filename}` : undefined;
  const row = await Dispute.create({ 
    uuid: uuidv4(), 
    chore_id: choreId, 
    reason, 
    image_url: photoUrl || null, 
    disputer_email: disputerEmail,
    status: "pending"
  });
  res.status(201).json(row);
});



export const sustain = controller(async (req, res) => {
  await Dispute.setStatus(req.params.uuid, "sustained");
  res.status(204).end();
});

export const overrule = controller(async (req, res) => {
  await Dispute.setStatus(req.params.uuid, "overruled");
  res.status(204).end();
});

// Note: approve and reject methods have been removed
// Disputes are now handled through the voting system at /dispute-votes endpoints