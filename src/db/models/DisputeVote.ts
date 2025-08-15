import { db } from "./index";
import { ModelError, dbGuard, mapFk, ensureUuid, ensureEmail, formatRowTimestamps } from "./BaseModel";

export type VoteType = "sustain" | "overrule";

export interface DisputeVoteRow {
  dispute_uuid: string;
  user_email: string;
  vote: VoteType;
  created_at?: string;
}

export interface DisputeVoteStatus {
  dispute_uuid: string;
  sustain_votes: number;
  overrule_votes: number;
  total_votes: number;
  required_votes: number;
  total_eligible_voters: number;
  is_sustained: boolean;
  is_overruled: boolean;
  is_24_hours_passed: boolean;
  hours_since_creation: number;
  voters: {
    user_email: string;
    vote: VoteType;
  }[];
}

export default class DisputeVote {
  static async vote(disputeUuid: string, userEmail: string, vote: VoteType): Promise<void> {
    ensureUuid(disputeUuid);
    ensureEmail(userEmail);
    
    return dbGuard(async () => {
      try {
        // Check if dispute exists and is pending
        const dispute = await db("disputes").where({ uuid: disputeUuid }).first();
        if (!dispute) {
          throw new ModelError("DISPUTE_NOT_FOUND", `Dispute not found: '${disputeUuid}'`, 404);
        }
        if (dispute.status !== "pending") {
          throw new ModelError("DISPUTE_NOT_PENDING", "Can only vote on pending disputes", 409);
        }

        // Check if user is in the same home as the dispute
        const chore = await db("chores").where({ uuid: dispute.chore_id }).first();
        if (!chore) {
          throw new ModelError("CHORE_NOT_FOUND", "Chore not found for dispute", 404);
        }

        // Check if user is in the same home as the dispute
        const userInHome = await db("user_homes")
          .where({ user_email: userEmail, home_id: chore.home_id })
          .first();
        if (!userInHome) {
          throw new ModelError("USER_NOT_IN_HOME", "User is not a member of this home", 403);
        }

        // Check if user is the one who claimed the chore (they cannot vote)
        if (chore.user_email === userEmail) {
          throw new ModelError("USER_CANNOT_VOTE", "The person who claimed the chore cannot vote on disputes", 403);
        }

        // Check if vote already exists
        const existingVote = await db("dispute_votes")
          .where({ dispute_uuid: disputeUuid, user_email: userEmail })
          .first();
        
        if (existingVote) {
          // Update only if vote is different
          if (existingVote.vote !== vote) {
            await db("dispute_votes")
              .where({ dispute_uuid: disputeUuid, user_email: userEmail })
              .update({ vote });
          }
        } else {
          // Insert new vote
          await db("dispute_votes")
            .insert({ dispute_uuid: disputeUuid, user_email: userEmail, vote });
        }

        // Check if we need to auto-approve or auto-reject based on votes
        await this.checkAndUpdateDisputeStatus(disputeUuid, chore.home_id);
      } catch (e: any) {
        throw mapFk(e, "Failed to vote on dispute");
      }
    }, "Failed to vote on dispute");
  }

  static async removeVote(disputeUuid: string, userEmail: string): Promise<void> {
    ensureUuid(disputeUuid);
    ensureEmail(userEmail);
    
    return dbGuard(async () => {
      const deleted = await db("dispute_votes")
        .where({ dispute_uuid: disputeUuid, user_email: userEmail })
        .del();
      
      if (!deleted) {
        throw new ModelError("VOTE_NOT_FOUND", "No vote found to remove", 404);
      }

      // Re-check dispute status after vote removal
      const dispute = await db("disputes").where({ uuid: disputeUuid }).first();
      if (dispute) {
        const chore = await db("chores").where({ uuid: dispute.chore_id }).first();
        if (chore) {
          await this.checkAndUpdateDisputeStatus(disputeUuid, chore.home_id);
        }
      }
    }, "Failed to remove vote");
  }

  static async getVoteStatus(disputeUuid: string): Promise<DisputeVoteStatus> {
    ensureUuid(disputeUuid);
    
    return dbGuard(async () => {
      // Get dispute and chore info
      const dispute = await db("disputes").where({ uuid: disputeUuid }).first();
      if (!dispute) {
        throw new ModelError("DISPUTE_NOT_FOUND", `Dispute not found: '${disputeUuid}'`, 404);
      }

      const chore = await db("chores").where({ uuid: dispute.chore_id }).first();
      if (!chore) {
        throw new ModelError("CHORE_NOT_FOUND", "Chore not found for dispute", 404);
      }

      // Get all votes for this dispute
      const votes = await db<DisputeVoteRow>("dispute_votes")
        .where({ dispute_uuid: disputeUuid })
        .orderBy("created_at", "asc");

      // Get total number of users in the home (excluding the person who claimed the chore)
      const homeUsers = await db("user_homes").where({ home_id: chore.home_id });
      const eligibleVoters = homeUsers.filter(user => user.user_email !== chore.user_email);
      const totalEligibleVoters = eligibleVoters.length;
      const requiredVotes = Math.ceil(totalEligibleVoters * 0.5); // 50% threshold of eligible voters

      // Count votes
      const sustainVotes = votes.filter(v => v.vote === "sustain").length;
      const overruleVotes = votes.filter(v => v.vote === "overrule").length;
      const totalVotes = votes.length;

      // Check if 24 hours have passed since dispute creation
      const disputeCreated = new Date(dispute.created_at!);
      const now = new Date();
      const hoursSinceCreation = (now.getTime() - disputeCreated.getTime()) / (1000 * 60 * 60);
      const is24HoursPassed = hoursSinceCreation >= 24;

      // Determine if dispute should be auto-sustained or auto-overruled
      let isSustained = false;
      let isOverruled = false;

      if (is24HoursPassed) {
        // After 24 hours, auto-overrule (dispute fails)
        isOverruled = true;
        isSustained = false;
      } else {
        // Before 24 hours, strict voting logic
        if (sustainVotes >= requiredVotes) {
          // Only sustain if half or more people voted sustain
          isSustained = true;
          isOverruled = false;
        } else if (overruleVotes >= requiredVotes) {
          // Only overrule if half or more people voted overrule
          isSustained = false;
          isOverruled = true;
        } else {
          // If not enough votes for either side, keep waiting
          isSustained = false;
          isOverruled = false;
        }
      }

      // IMPORTANT: Do not auto-resolve here to avoid mutual recursion
      // Resolution is triggered from vote/removeVote flows only

      return {
        dispute_uuid: disputeUuid,
        sustain_votes: sustainVotes,
        overrule_votes: overruleVotes,
        total_votes: totalVotes,
        required_votes: requiredVotes,
        total_eligible_voters: totalEligibleVoters,
        is_sustained: isSustained,
        is_overruled: isOverruled,
        is_24_hours_passed: is24HoursPassed,
        hours_since_creation: hoursSinceCreation,
        voters: votes.map(v => ({
          user_email: v.user_email,
          vote: v.vote
        }))
      };
    }, "Failed to get vote status");
  }

  static async getUserVote(disputeUuid: string, userEmail: string): Promise<VoteType | null> {
    ensureUuid(disputeUuid);
    ensureEmail(userEmail);
    
    return dbGuard(async () => {
      const vote = await db<DisputeVoteRow>("dispute_votes")
        .where({ dispute_uuid: disputeUuid, user_email: userEmail })
        .first();
      
      return vote ? vote.vote : null;
    }, "Failed to get user vote");
  }

  private static async checkAndUpdateDisputeStatus(disputeUuid: string, homeId: string): Promise<void> {
    // Re-compute status locally to avoid calling getVoteStatus (prevents recursion)
    const dispute = await db("disputes").where({ uuid: disputeUuid }).first();
    if (!dispute) return;
    const chore = await db("chores").where({ uuid: dispute.chore_id }).first();
    if (!chore) return;

    const votes = await db<DisputeVoteRow>("dispute_votes").where({ dispute_uuid: disputeUuid });
    const homeUsers = await db("user_homes").where({ home_id: chore.home_id });
    const eligibleVoters = homeUsers.filter((u: any) => u.user_email !== chore.user_email);
    const requiredVotes = Math.ceil(eligibleVoters.length * 0.5);
    const sustainVotes = votes.filter(v => v.vote === "sustain").length;
    const overruleVotes = votes.filter(v => v.vote === "overrule").length;

    const voteStatus = {
      sustain_votes: sustainVotes,
      overrule_votes: overruleVotes,
      required_votes: requiredVotes,
      total_eligible_voters: eligibleVoters.length,
      is_sustained: sustainVotes >= requiredVotes,
      is_overruled: overruleVotes >= requiredVotes,
      is_24_hours_passed: (new Date().getTime() - new Date(dispute.created_at!).getTime()) / (1000*60*60) >= 24,
    } as any;
    

    
    if (voteStatus.is_sustained) {
      // Auto-sustain the dispute
      await db.transaction(async (trx) => {
        await trx("disputes").where({ uuid: disputeUuid }).update({ 
          status: "sustained", 
          updated_at: trx.fn.now() 
        });

        // Get the dispute and chore info for point reversal
        const dispute = await trx("disputes").where({ uuid: disputeUuid }).first();
        if (dispute) {
          const chore = await trx("chores").where({ uuid: dispute.chore_id }).first();
          if (chore && chore.user_email && chore.points > 0) {
            // Calculate the dynamic points that were awarded when the chore was completed
            let pointsToRemove = chore.points;
            
            // Use the claimed_at timestamp for accurate calculation
            if (chore.claimed_at) {
              const created = new Date(chore.created_at!);
              const claimed = new Date(chore.claimed_at);
              const hoursUnclaimed = (claimed.getTime() - created.getTime()) / (1000 * 60 * 60);
              const bonusMultiplier = Math.min(1 + (hoursUnclaimed / 24) * 0.1, 2.0);
              // Fix floating-point precision by using a more precise calculation
              const exactPoints = chore.points * bonusMultiplier;
              // Use a more explicit rounding approach to handle floating-point precision
              pointsToRemove = Math.round(Math.round(exactPoints * 1000000) / 1000000);
            }
            
            // Remove the dynamic points from the user, but don't go below 0
            const currentUser = await trx("user_homes")
              .where({ home_id: chore.home_id, user_email: chore.user_email })
              .first();
            
            if (currentUser) {
              const newPoints = Math.max(0, currentUser.points - pointsToRemove);
              await trx("user_homes")
                .where({ home_id: chore.home_id, user_email: chore.user_email })
                .update({ points: newPoints });
            }
            
            // Reverse chore completion: change status back to "claimed" and clear completed_at
            await trx("chores")
              .where({ uuid: dispute.chore_id })
              .update({ 
                status: "claimed", 
                completed_at: null 
              });
          }
        }

      });
    } else if (voteStatus.is_overruled) {
      // Auto-overrule the dispute (either by votes or 24-hour timeout)
      await db.transaction(async (trx) => {
        await trx("disputes").where({ uuid: disputeUuid }).update({ 
          status: "overruled", 
          updated_at: trx.fn.now() 
        });
        
        // For overruled disputes, ensure the chore remains completed
        // (no need to change chore status since dispute was overruled)

      });
    } else {

    }
  }
} 