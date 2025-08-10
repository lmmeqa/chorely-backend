import { controller } from "../middleware";
import { DisputeVote, VoteType } from "../db/models";

export const vote = controller(async (req, res) => {
  const { disputeUuid } = req.params;
  const { userEmail, vote } = req.body as { userEmail: string; vote: VoteType };
  
  await DisputeVote.vote(disputeUuid, userEmail, vote);
  res.status(204).end();
});

export const removeVote = controller(async (req, res) => {
  const { disputeUuid } = req.params;
  const { userEmail } = req.body as { userEmail: string };
  
  await DisputeVote.removeVote(disputeUuid, userEmail);
  res.status(204).end();
});

export const getVoteStatus = controller(async (req, res) => {
  const { disputeUuid } = req.params;
  
  const voteStatus = await DisputeVote.getVoteStatus(disputeUuid);
  res.json(voteStatus);
});

export const getUserVote = controller(async (req, res) => {
  const { disputeUuid, userEmail } = req.params;
  
  const vote = await DisputeVote.getUserVote(disputeUuid, userEmail);
  res.json({ vote });
}); 