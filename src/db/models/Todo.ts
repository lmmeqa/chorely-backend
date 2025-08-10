import { db } from "./index";
import { ModelError, dbGuard, ensureUuid, BaseModel, formatRowTimestamps } from "./BaseModel";

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

  static async create(todoData: Omit<TodoRow, "id">): Promise<TodoRow> {
    return dbGuard(async () => {
      const result = await db<TodoRow>("todo_items").insert(todoData).returning("*");
      return result[0];
    }, "Failed to create todo");
  }

  static async findById(id: string): Promise<TodoRow | null> {
    ensureUuid(id);
    return dbGuard(async () => {
      const todo = await db<TodoRow>("todo_items").where({ id }).first();
      return todo || null;
    }, "Failed to fetch todo");
  }

  static async all(): Promise<TodoRow[]> {
    return dbGuard(async () => {
      return await db<TodoRow>("todo_items").orderBy("order");
    }, "Failed to fetch todos");
  }
}