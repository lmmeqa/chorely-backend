import { db } from "./index";
import { ModelError, dbGuard, mapFk, ensureUuid, formatRowTimestamps } from "./BaseModel";

export type DisputeStatus = "pending" | "approved" | "rejected";

export interface DisputeRow {
  uuid: string;
  chore_id: string; // FK → chores.uuid
  disputer_email: string; // FK → users.email
  reason: string;
  image_url: string | null;
  status: DisputeStatus;
  created_at?: string;
  updated_at?: string;
}

export default class Dispute {
  static list(status?: DisputeStatus) {
    return status
      ? db<DisputeRow>("disputes").where({ status }).orderBy("created_at", "desc")
      : db<DisputeRow>("disputes").orderBy("created_at", "desc");
  }

  static async findByUuid(uuid: string): Promise<DisputeRow | null> {
    ensureUuid(uuid);
    return dbGuard(async () => {
      const dispute = await db<DisputeRow>("disputes").where({ uuid }).first();
      return dispute ? formatRowTimestamps(dispute) : null;
    }, "Failed to fetch dispute");
  }

  static async create(row: Omit<DisputeRow, "updated_at">) {
    return dbGuard(async () => {
      try {
        return (await db<DisputeRow>("disputes").insert(row).returning("*"))[0] as DisputeRow;
      } catch (e: any) { 
        throw mapFk(e, "Chore or user does not exist"); 
      }
    }, "Failed to create dispute");
  }

  static async setStatus(uuid: string, status: DisputeStatus) {
    ensureUuid(uuid);
    return dbGuard(async () => {
      const dispute = await db<DisputeRow>("disputes").where({ uuid }).first();
      if (!dispute) throw new ModelError("DISPUTE_NOT_FOUND", `Dispute not found: '${uuid}'`, 404);

      // If status is unchanged, nothing to do
      if (dispute.status === status) {
        return;
      }

      await db.transaction(async (trx) => {
        await trx("disputes").where({ uuid }).update({ status, updated_at: trx.fn.now() });

        // On approve, remove points from the chore assignee and reverse chore completion
        if (status === "approved") {
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
              pointsToRemove = Math.round(chore.points * bonusMultiplier);
            }
            
            // Remove the dynamic points from the user
            await trx("user_homes")
              .where({ home_id: chore.home_id, user_email: chore.user_email })
              .decrement("points", pointsToRemove);
            
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
    }, "Failed to update dispute");
  }
}