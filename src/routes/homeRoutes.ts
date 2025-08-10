import { Router } from "express";
import {
  createHome,
  getHomeById,
  listHomes,
  getHomeUsers,
  updateWeeklyQuota,
} from "../controllers/homeController";

const r = Router();

r.post("/",  createHome);   // POST /homes
r.get ("/",  listHomes);    // GET  /homes
r.get ("/:id", getHomeById);// GET  /homes/:id
r.get ("/:id/users", getHomeUsers);// GET  /homes/:id/users
r.patch("/:id/quota", updateWeeklyQuota);// PATCH /homes/:id/quota { weeklyPointQuota }

export default r;
