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
