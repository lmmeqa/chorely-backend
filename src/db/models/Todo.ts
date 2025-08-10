import { db } from "./index";
import { ModelError, dbGuard, ensureUuid, BaseModel } from "./BaseModel";

export interface TodoRow {
  id: string;
  chore_id: string;
  name: string;
  description: string;
  order: number;
}

export default class TodoItem extends BaseModel<TodoRow> {
  static async forChore(chore_id: string): Promise<TodoRow[]> {
    ensureUuid(chore_id);
    return dbGuard(async () => {
      return await db<TodoRow>("todo_items").where({ chore_id }).orderBy("order");
    }, "Failed to fetch todo items for chore");
  }
}