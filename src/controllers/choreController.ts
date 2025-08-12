import { controller } from "../middleware";
import { Chore, User, db } from "../db/models";
import multer from "multer";
import path from "path";
import fs from "fs";

export const createChore = controller(async (req, res) => {
  const chore = await Chore.create(req.body); // expects { name, description, …, home_id }
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
  const file = (req as any).file as Express.Multer.File | undefined;
  if (file) {
    const uploadPath = `/uploads/${path.basename(file.path)}`;
    await db("chores").where({ uuid: req.params.uuid }).update({ photo_url: uploadPath });
  }
  await Chore.verify(req.params.uuid); // verify and complete are the same action
  res.status(204).end();
});


// in controllers/choreController.ts
export const getById = controller(async (req, res) => {
  res.json(await Chore.findByUuid(req.params.uuid));
});

