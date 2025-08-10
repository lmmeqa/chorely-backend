import { Router } from "express";
import { vote, removeVote, getVoteStatus, getUserVote } from "../controllers/disputeVoteController";

const r = Router();

r.post("/:disputeUuid/vote", vote);                    // POST   /dispute-votes/:disputeUuid/vote
r.delete("/:disputeUuid/vote", removeVote);            // DELETE /dispute-votes/:disputeUuid/vote
r.get("/:disputeUuid/status", getVoteStatus);          // GET    /dispute-votes/:disputeUuid/status
r.get("/:disputeUuid/user/:userEmail", getUserVote);   // GET    /dispute-votes/:disputeUuid/user/:userEmail

export default r; 