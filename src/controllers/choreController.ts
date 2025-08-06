import { controller } from "./.controller";
import Chore from "../db/models/Chore";
import User from "../db/models/User";

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
  const statuses = req.query.status ? (req.query.status as string).split(",") : undefined;
  res.json(await Chore.forUser(req.params.email, statuses as any));
});

export const approveChore = controller(async (req, res) => {
  await Chore.approve(req.params.uuid);
  res.status(204).end();
});

export const claimChore = controller(async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  await Chore.claim(req.params.uuid, user.id);
  res.status(204).end();
});

export const completeChore = controller(async (req, res) => {
  await Chore.complete(req.params.uuid);
  res.status(204).end();
});

export const verifyChore = controller(async (req, res) => {
  await Chore.verify(req.params.uuid);
  res.status(204).end();
});
