import { Router } from "express";
import { vote, removeVote, getVoteStatus, getUserVote } from "../controllers/disputeVoteController";
import { verifySupabaseToken } from "../middleware/supabaseAuth";
import { requireHomeMemberByDisputeUuidParam, requireSelfEmailByParam } from "../middleware/authorization";

const r = Router();
r.use(verifySupabaseToken);

r.post("/:disputeUuid/vote", requireHomeMemberByDisputeUuidParam("disputeUuid"), vote);
r.delete("/:disputeUuid/vote", requireHomeMemberByDisputeUuidParam("disputeUuid"), removeVote);
r.get("/:disputeUuid/status", requireHomeMemberByDisputeUuidParam("disputeUuid"), getVoteStatus);
r.get("/:disputeUuid/user/:userEmail", requireHomeMemberByDisputeUuidParam("disputeUuid"), requireSelfEmailByParam('userEmail'), getUserVote);

export default r; 