import { db } from "./index";
import { ModelError, dbGuard, mapFk, ensureUuid } from "./BaseModel";

export default class Approval {
  static async voters(choreUuid: string): Promise<string[]> {
    const rows = await db("chore_approvals").where({ chore_uuid: choreUuid });
    return rows.map((r: any) => r.user_email as string);
  }

  static async vote(choreUuid: string, userEmail: string) {
    ensureUuid(choreUuid);
    return dbGuard(async () => {
      try {
        // Check if user has already voted
        const existingVote = await db("chore_approvals")
          .where({ chore_uuid: choreUuid, user_email: userEmail })
          .first();
        
        if (existingVote) {
          throw new Error("User has already voted on this chore");
        }
        
        // Insert the vote
        await db("chore_approvals")
          .insert({ chore_uuid: choreUuid, user_email: userEmail });
        return this.voters(choreUuid);
      } catch (e: any) { 
        if (e.message === "User has already voted on this chore") {
          throw e;
        }
        throw mapFk(e, "Chore or user does not exist"); 
      }
    }, "Failed to vote");
  }

  static async unvote(choreUuid: string, userEmail: string) {
    ensureUuid(choreUuid);
    return dbGuard(async () => {
      await db("chore_approvals").where({ chore_uuid: choreUuid, user_email: userEmail }).del();
      return this.voters(choreUuid);
    }, "Failed to remove vote");
  }
}