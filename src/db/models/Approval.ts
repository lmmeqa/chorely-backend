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
        await db("chore_approvals")
          .insert({ chore_uuid: choreUuid, user_email: userEmail })
          .onConflict(["chore_uuid", "user_email"]).ignore();
        return this.voters(choreUuid);
      } catch (e: any) { 
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