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
      const n = await db("disputes").where({ uuid }).update({ status, updated_at: db.fn.now() });
      if (!n) throw new ModelError("DISPUTE_NOT_FOUND", `Dispute not found: '${uuid}'`, 404);
    }, "Failed to update dispute");
  }
}