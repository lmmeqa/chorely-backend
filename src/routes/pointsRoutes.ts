import { Router } from "express";
import { getAll, getForUser, addForUser, updateUserPoints } from "../controllers/pointsController";

const r = Router();

r.get("/:homeId", getAll);                       // GET  /points/:homeId
r.get("/:homeId/:email", getForUser);            // GET  /points/:homeId/:email
r.post("/:homeId/:email", addForUser);           // POST /points/:homeId/:email { delta }
r.put("/:homeId/:email", updateUserPoints);      // PUT  /points/:homeId/:email { points }

export default r;