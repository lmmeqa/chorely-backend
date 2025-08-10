import { controller } from "./.controller";
import { TodoItem } from "../db/models";

export const getTodoItems = controller(async (req, res) => {
  const { choreId } = req.params;
  const todoItems = await TodoItem.forChore(choreId);
  res.json(todoItems);
});
