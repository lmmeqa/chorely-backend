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

  // Note: setStatus method has been removed as disputes are now handled through the voting system
  // The voting system automatically updates dispute status based on vote results
}