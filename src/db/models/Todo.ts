import { db } from "./index";
import { ModelError, dbGuard, ensureUuid, BaseModel, formatRowTimestamps } from "./BaseModel";

export interface TodoRow {
  id: string;
  chore_id: string;
  name: string;
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
      // If order is specified, ensure it doesn't conflict with existing todos
      if (todoData.order !== undefined) {
        await this.ensureOrderAvailable(todoData.chore_id, todoData.order);
      } else {
        // If no order specified, add to the end
        const existingTodos = await this.forChore(todoData.chore_id);
        todoData.order = existingTodos.length;
      }
      
      const result = await db<TodoRow>("todo_items").insert(todoData).returning("*");
      return result[0];
    }, "Failed to create todo");
  }

  static async ensureOrderAvailable(chore_id: string, desiredOrder: number): Promise<void> {
    // Get all todos for this chore ordered by their current order
    const existingTodos = await this.forChore(chore_id);
    
    // If the desired order is beyond the current range, just use it
    if (desiredOrder >= existingTodos.length) {
      return;
    }
    
    // If there's already a todo at this order, shift all todos from this position onwards
    const todosToShift = existingTodos.filter(todo => todo.order >= desiredOrder);
    
    if (todosToShift.length > 0) {
      // Update orders in reverse order to avoid conflicts
      for (let i = todosToShift.length - 1; i >= 0; i--) {
        const todo = todosToShift[i];
        await db<TodoRow>("todo_items")
          .where({ id: todo.id })
          .update({ order: todo.order + 1 });
      }
    }
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