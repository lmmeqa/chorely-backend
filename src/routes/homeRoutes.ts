import { Router } from "express";
import {
  createHome,
  getHomeById,
  listHomes,
} from "../controllers/homeController";

const r = Router();

r.post("/",  createHome);   // POST /homes
r.get ("/",  listHomes);    // GET  /homes
r.get ("/:id", getHomeById);// GET  /homes/:id

export default r;
