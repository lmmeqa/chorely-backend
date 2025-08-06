// src/controllers/userController.ts
import { controller } from "./.controller";
import User from "../db/models/User";

/* POST /users */
export const createUser = controller(async (req, res) => {
  const user = await User.create(req.body.email, req.body.home_id);
  res.status(201).json(user);
});

/* GET /user/login */
export const getUser = controller(async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  user ? res.json(user) : res.status(404).end();
});

/* GET /user/homes */
export const getHomes = controller(async (req, res) => {
  // 1. fetch user row (throws 404 if not found)
  const user = await User.findByEmail(req.body.email);
  if (!user) throw new Error("User not found");

  // 2. pull all homes via join table
  const homes = await User.homes(user.id);

  res.json(homes);               // always 200 on success
});
