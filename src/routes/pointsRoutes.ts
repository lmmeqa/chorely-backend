import { Router } from "express";
import { getAll, getForUser, addForUser, updateUserPoints } from "../controllers/pointsController";
import { verifySupabaseToken } from "../middleware/supabaseAuth";
import { requireHomeMemberByParam, requireHomeMemberByQuery, requireSelfEmailByQuery } from "../middleware/authorization";

const r = Router();
r.use(verifySupabaseToken);

r.get("/:homeId", requireHomeMemberByParam("homeId"), getAll);
r.get("/:homeId/:email", requireHomeMemberByParam("homeId"), getForUser);
r.post("/:homeId/:email", requireHomeMemberByParam("homeId"), addForUser);
r.put("/:homeId/:email", requireHomeMemberByParam("homeId"), updateUserPoints);

export default r;