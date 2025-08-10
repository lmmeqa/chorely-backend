import { controller } from "../middleware";
import { TodoItem } from "../db/models";
import { v4 as uuidv4 } from "uuid";

export const getTodoItems = controller(async (req, res) => {
  const { choreId } = req.params;
  const todoItems = await TodoItem.forChore(choreId);
  res.json(todoItems);
});

export const createTodo = controller(async (req, res) => {
  const { name, description, chore_id, order = 0 } = req.body;
  const todoData = {
    chore_id,
    name,
    description,
    order
  };
  const todo = await TodoItem.create(todoData);
  res.status(201).json(todo);
});

export const getTodoById = controller(async (req, res) => {
  const todo = await TodoItem.findById(req.params.id);
  if (!todo) {
    return res.status(404).json({ error: "Todo not found" });
  }
  res.json(todo);
});

export const getAllTodos = controller(async (req, res) => {
  const todos = await TodoItem.all();
  res.json(todos);
});
