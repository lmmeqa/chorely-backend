import { controller } from "../middleware";
import { Chore, User, Approval, db } from "../db/models";
import { GptService } from "../services/gptService";
import path from "path";
import fs from "fs";

export const createChore = controller(async (req, res) => {
  // Validate required fields
  if (!req.body.user_email) {
    return res.status(400).json({ error: "user_email is required" });
  }
  
  // Create the chore first - exclude user_email from the data to be stored
  const { user_email, ...choreData } = req.body;
  const chore = await Chore.create(choreData);
  
  // Automatically add a vote from the creator
  try {
    await Approval.vote(chore.uuid, req.body.user_email);
    console.log(`\x1b[32m[VOTE]\x1b[0m Auto-vote added for chore ${chore.uuid} by ${req.body.user_email}`);
  } catch (err) {
    // Log but don't fail chore creation if auto-vote fails
    console.error("Failed to add auto-vote for chore", chore.uuid, err);
  }
  
  // Generate todos asynchronously after chore creation
  (async () => {
    try {
      const generatedTodos = await GptService.generateTodosForChore(
        req.body.name,
        req.body.description
      );
      if (!generatedTodos || generatedTodos.length === 0) return;

      await Chore.addTodos(chore.uuid, generatedTodos);
    } catch (err) {
      // Log and continue; creation of chore should not fail due to todo generation
      console.error("Failed to generate/insert todos for chore", chore.uuid, err);
    }
  })();

  res.status(201).json(chore);
});

export const listAvailable = controller(async (req, res) => {
  res.json(await Chore.available(req.params.homeId));
});

export const listUnapproved = controller(async (req, res) => {
  res.json(await Chore.unapproved(req.params.homeId));
});

export const listUserChores = controller(async (req, res) => {
  const { email, homeId } = (req.query as any) as { email: string; homeId: string };
  res.json(await Chore.forUser(email, homeId)); // implement in model
});

export const approveChore = controller(async (req, res) => {
  await Chore.approve(req.params.uuid);
  res.status(204).end();
});

export const claimChore = controller(async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  await Chore.claim(req.params.uuid, user.email);
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

