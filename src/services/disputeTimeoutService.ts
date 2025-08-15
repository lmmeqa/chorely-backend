import { db } from "../db/models";
import { DisputeVote } from "../db/models";

export class DisputeTimeoutService {
  private static timeoutInterval: NodeJS.Timeout | null = null;

  /**
   * Check for disputes that have passed 24 hours and auto-overrule them if they don't have enough sustain votes
   */
  static async checkTimeoutDisputes(): Promise<void> {
    try {
      // Get all pending disputes
      const pendingDisputes = await db("disputes")
        .where({ status: "pending" })
        .orderBy("created_at", "asc");

      const now = new Date();
      
      for (const dispute of pendingDisputes) {
        const disputeCreated = new Date(dispute.created_at!);
        const hoursSinceCreation = (now.getTime() - disputeCreated.getTime()) / (1000 * 60 * 60);
        
        // Check if 24 hours have passed
        if (hoursSinceCreation >= 24) {
          // Get the chore to find eligible voters
          const chore = await db("chores").where({ uuid: dispute.chore_id }).first();
          if (!chore) continue;

          // Get eligible voters (excluding the person who claimed the chore)
          const homeUsers = await db("user_homes").where({ home_id: chore.home_id });
          const eligibleVoters = homeUsers.filter(user => user.user_email !== chore.user_email);
          const totalEligibleVoters = eligibleVoters.length;
          const requiredVotes = Math.ceil(totalEligibleVoters * 0.5);

          // Get current votes
          const votes = await db("dispute_votes")
            .where({ dispute_uuid: dispute.uuid });
          
          const sustainVotes = votes.filter(v => v.vote === "sustain").length;
          
          // After 24 hours, auto-overrule regardless of vote count
          await db("disputes")
            .where({ uuid: dispute.uuid })
            .update({ 
              status: "overruled", 
              updated_at: db.fn.now() 
            });
          
  
        }
      }
    } catch (error) {
      console.error("Error checking timeout disputes:", error);
    }
  }

  /**
   * Start the timeout checking service (runs every hour)
   */
  static startTimeoutService(): void {
    // Clear any existing interval to prevent memory leaks
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }
    
    // Check every hour
    this.timeoutInterval = setInterval(() => {
      this.checkTimeoutDisputes();
    }, 60 * 60 * 1000); // 1 hour in milliseconds
    
    // Also check immediately on startup
    this.checkTimeoutDisputes();
  }

  /**
   * Stop the timeout checking service
   */
  static stopTimeoutService(): void {
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
      this.timeoutInterval = null;
    }
  }
} 