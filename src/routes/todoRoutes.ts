import { Router } from "express";
import { getTodoItems, createTodo, getTodoById, getAllTodos } from "../controllers/todoController";

const r = Router();

r.get("/", getAllTodos);                    // GET    /todos
r.post("/", createTodo);                    // POST   /todos
r.get("/:id", getTodoById);                 // GET    /todos/:id
r.get("/chore/:choreId", getTodoItems);     // GET    /todos/chore/:choreId

export default r;
