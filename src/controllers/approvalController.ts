import { controller } from "../middleware";
import { Chore, Approval, User } from "../db/models";

const calcRequired = async (homeId: string) => {
  const users = await User.byHome(homeId); // implement if missing → SELECT users by user_homes
  return Math.ceil(users.length * 0.5) || 1; // 50% threshold, ≥1
};

export const getStatus = controller(async (req, res) => {
  const chore = await Chore.findByUuid(req.params.uuid);
  const voters = await Approval.voters(chore.uuid);
  const required = await calcRequired(chore.home_id);
  res.json({ status: chore.status, voters, votes: voters.length, required });
});

export const vote = controller(async (req, res) => {
  const { userEmail } = req.body as { userEmail: string };
  const chore = await Chore.findByUuid(req.params.uuid);
  const voters = await Approval.vote(chore.uuid, userEmail);
  const required = await calcRequired(chore.home_id);
  if (voters.length >= required && chore.status === "unapproved") {
    await Chore.setStatus(chore.uuid, "unclaimed");
  }
  res.json({ approved: voters.length >= required, votes: voters.length, required, voters });
});

export const unvote = controller(async (req, res) => {
  const { userEmail } = req.body as { userEmail: string };
  const chore = await Chore.findByUuid(req.params.uuid);
  const voters = await Approval.unvote(chore.uuid, userEmail);
  const required = await calcRequired(chore.home_id);
  
  // Check if votes have dropped below threshold and revert to unapproved
  if (voters.length < required && chore.status === "unclaimed") {
    await Chore.setStatus(chore.uuid, "unapproved");
  }
  
  res.json({ approved: voters.length >= required, votes: voters.length, required, voters });
});