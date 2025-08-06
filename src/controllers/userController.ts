// src/controllers/userController.ts
import { controller } from "./.controller";
import User from "../db/models/User";

export const createUser = controller(async (req, res) => {
  const user = await User.create(req.body.email, req.body.homeIds); // homeIds: string[]
  res.status(201).json(user);
});

export const loginUser = controller(async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  res.json(user);                                  // 200
});

export const getUserHomes = controller(async (req, res) => {
  const user = await User.findByEmail(req.params.email);
  const homes = await User.homes(user.id);
  res.json(homes);
});

export const joinHome = controller(async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  await User.joinHome(user.id, req.body.homeId);
  res.status(204).end();
});