import db from "./db";
export interface TodoRow {
  id: string;
  chore_id: string;
  name: string;
  description: string;
  order: number;
}
export default class TodoItem {
  static forChore(chore_id: string) {
    return db<TodoRow>("todo_items").where({ chore_id }).orderBy("order");
  }
}

