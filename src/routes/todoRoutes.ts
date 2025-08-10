import { Router } from "express";
import { getTodoItems } from "../controllers/todoController";

const r = Router();

r.get("/:choreId", getTodoItems);  // GET /todos/:choreId

export default r;
