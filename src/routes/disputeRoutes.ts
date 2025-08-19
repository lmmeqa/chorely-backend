import { Router } from "express";
import { list, create, sustain, overrule, getById, disputeUpload } from "../controllers/disputeController";
import { verifySupabaseToken } from "../middleware/supabaseAuth";
import { requireHomeMemberByDisputeUuidParam, requireHomeMemberByChoreUuidBody, requireHomeMemberByQuery } from "../middleware/authorization";

const r = Router();
r.use(verifySupabaseToken);

r.get("/", requireHomeMemberByQuery("homeId"), list);                        // GET    /disputes?homeId=:id&status=pending
r.get("/:uuid", requireHomeMemberByDisputeUuidParam("uuid"), getById);
r.post("/", requireHomeMemberByChoreUuidBody("choreId"), disputeUpload.single('image'), create);
r.patch("/:uuid/sustain", requireHomeMemberByDisputeUuidParam("uuid"), sustain);
r.patch("/:uuid/overrule", requireHomeMemberByDisputeUuidParam("uuid"), overrule);

export default r;