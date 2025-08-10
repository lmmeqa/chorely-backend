import { controller } from "../middleware";
import { Dispute } from "../db/models";
import { v4 as uuidv4 } from "uuid";

export const list = controller(async (req, res) => {
  const status = (req.query.status as string) as any;
  res.json(await Dispute.list(status));
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