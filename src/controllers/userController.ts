// src/controllers/userController.ts
import { controller } from "./.controller";
import { User } from "../db/models";

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
  const homes = await User.homes(user.email)
  res.json(homes);
});

export const joinHome = controller(async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  await User.joinHome(user.email, req.body.homeId);
  res.status(204).end();
});

// in controllers/userController.ts
export const leaveHome = controller(async (req, res) => {
  const { email, homeId } = req.body;
  const user = await User.findByEmail(email);
  await User.leaveHome(user.email, homeId);
  res.status(204).end();
});

export const getByEmail = controller(async (req, res) => {
  // throws USER_NOT_FOUND if not present
  const user = await User.findByEmail(req.params.email);
  res.json(user);
});