import { db } from "./index";
import { ModelError, dbGuard, mapFk, ensureUuid } from "./BaseModel";

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
      await db.transaction(async (trx) => {
        const dispute = await trx<DisputeRow>("disputes").where({ uuid }).forUpdate().first();
        if (!dispute) throw new ModelError("DISPUTE_NOT_FOUND", `Dispute not found: '${uuid}'`, 404);

        // If status is unchanged, nothing to do
        if (dispute.status === status) {
          return;
        }

        await trx("disputes").where({ uuid }).update({ status, updated_at: trx.fn.now() });

        // On approve, remove points from the chore assignee, once
        if (status === "approved") {
          const chore = await trx("chores").where({ uuid: dispute.chore_id }).first();
          if (chore && chore.user_email && chore.points > 0) {
            await trx("user_homes")
              .where({ home_id: chore.home_id, user_email: chore.user_email })
              .decrement("points", chore.points);
          }
        }
      });
    }, "Failed to update dispute");
  }
}