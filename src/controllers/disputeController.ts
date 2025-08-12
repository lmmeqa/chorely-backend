import { controller } from "../middleware";
import { Dispute } from "../db/models";
import { db } from "../db/models";
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
      "chores.user_email as chore_user_email"
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

export const create = controller(async (req, res) => {
  const { choreId, reason, imageUrl, disputerEmail } = req.body;
  const row = await Dispute.create({ 
    uuid: uuidv4(), 
    chore_id: choreId, 
    reason, 
    image_url: imageUrl, 
    disputer_email: disputerEmail,
    status: "pending"
  });
  res.status(201).json(row);
});



export const approve = controller(async (req, res) => {
  await Dispute.setStatus(req.params.uuid, "approved");
  res.status(204).end();
});

export const reject = controller(async (req, res) => {
  await Dispute.setStatus(req.params.uuid, "rejected");
  res.status(204).end();
});

// Note: approve and reject methods have been removed
// Disputes are now handled through the voting system at /dispute-votes endpoints