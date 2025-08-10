import { controller } from "../middleware";
import { TodoItem } from "../db/models";
import { GptService } from "../services/gptService";
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

export const generateTodosForChore = controller(async (req, res) => {
  const { choreName, choreDescription } = req.body;
  
  if (!choreName || !choreDescription) {
    return res.status(400).json({ 
      error: "choreName and choreDescription are required" 
    });
  }
  
  try {
    const generatedTodos = await GptService.generateTodosForChore(choreName, choreDescription);
    res.json({
      choreName,
      choreDescription,
      todos: generatedTodos
    });
  } catch (error) {
    console.error("Failed to generate todos:", error);
    res.status(500).json({ 
      error: "Failed to generate todos",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
