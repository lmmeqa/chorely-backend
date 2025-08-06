// src/controllers/choreController.ts
import { controller } from "./.controller";
import Chore from "../db/models/Chore";

/* POST /chores */
export const createChore = controller(async (req, res) => {
  const chore = await Chore.create(req.body);
  res.status(201).json(chore);
});
