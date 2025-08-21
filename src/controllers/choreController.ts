import { controller } from "../middleware";
import { Chore, User, Approval, db } from "../db/models";
import { GptService } from "../services/gptService";
import path from "path";
import fs from "fs";

export const createChore = controller(async (req, res) => {
  const creatorEmail = (req as any).user?.email as string | undefined;
  if (!creatorEmail) return res.status(401).json({ error: "Unauthorized" });
  
  // Create the chore first
  const chore = await Chore.create(req.body);
  
  // Automatically add a vote from the creator (from token)
  try {
    await Approval.vote(chore.uuid, creatorEmail);
    console.log(`\x1b[32m[VOTE]\x1b[0m Auto-vote added for chore ${chore.uuid} by ${creatorEmail}`);
  } catch (err) {
    console.error("Failed to add auto-vote for chore", chore.uuid, err);
  }
  
  // Generate todos synchronously after chore creation
  try {
    const generatedTodos = await GptService.generateTodosForChore(
      req.body.name,
      req.body.description
    );
    if (generatedTodos && generatedTodos.length > 0) {
      await Chore.addTodos(chore.uuid, generatedTodos);
    }
  } catch (err) {
    // Log and continue; creation of chore should not fail due to todo generation
    console.error("Failed to generate/insert todos for chore", chore.uuid, err);
  }

  res.status(201).json(chore);
});

export const listAvailable = controller(async (req, res) => {
  res.json(await Chore.available(req.params.homeId));
});

export const listUnapproved = controller(async (req, res) => {
  res.json(await Chore.unapproved(req.params.homeId));
});

export const listUserChores = controller(async (req, res) => {
  const email = (req as any).user?.email as string | undefined;
  const { homeId } = (req.query as any) as { homeId: string };
  if (!email) return res.status(401).json({ error: 'Unauthorized' });
  res.json(await Chore.forUser(email, homeId));
});

export const approveChore = controller(async (req, res) => {
  await Chore.approve(req.params.uuid);
  res.status(204).end();
});

export const claimChore = controller(async (req, res) => {
  const email = (req as any).user?.email as string | undefined;
  if (!email) return res.status(401).json({ error: 'Unauthorized' });
  await Chore.claim(req.params.uuid, email);
  res.status(204).end();
});

export const verifyChore = controller(async (req, res) => {
  await Chore.verify(req.params.uuid);
  res.status(204).end();
});

export const completeChore = controller(async (req, res) => {
  const file = (req as any).file as any;
  if (file) {
    // Use the filename that multer generated (with extension)
    const uploadPath = `/uploads/${file.filename}`;
    console.log(`\x1b[35m[UPLOAD]\x1b[0m Chore completion image uploaded: ${file.filename} (${file.size} bytes)`);
    await db("chores").where({ uuid: req.params.uuid }).update({ photo_url: uploadPath });
  }
  await Chore.verify(req.params.uuid); // verify and complete are the same action
  res.status(204).end();
});


// in controllers/choreController.ts
export const getById = controller(async (req, res) => {
  res.json(await Chore.findByUuid(req.params.uuid));
});

