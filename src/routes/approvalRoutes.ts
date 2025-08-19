import { Router } from "express";
import { getStatus, vote, unvote } from "../controllers/approvalController";
import { verifySupabaseToken } from "../middleware/supabaseAuth";
import { requireHomeMemberByChoreUuidParam } from "../middleware/authorization";

const r = Router();
r.use(verifySupabaseToken);

r.get("/:uuid", requireHomeMemberByChoreUuidParam("uuid"), getStatus);
r.post("/:uuid/vote", requireHomeMemberByChoreUuidParam("uuid"), vote);
r.post("/:uuid/unvote", requireHomeMemberByChoreUuidParam("uuid"), unvote);

export default r;