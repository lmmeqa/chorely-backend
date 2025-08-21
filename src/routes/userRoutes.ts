import { Router } from "express";
import {
  createUser,
  loginUser,
  getUserHomes,
  joinHome,
  leaveHome,
  getByEmail,
  deleteMe,
} from "../controllers/userController";
import { verifySupabaseToken } from "../middleware/supabaseAuth";

const r = Router();

r.post("/",           createUser);          // POST /users          { email, homeIds[] }
r.post("/login",      loginUser);           // POST /users/login    { email }
r.get ("/:email",     getByEmail);          // GET  /users/:email
r.get ("/:email/home", getUserHomes);       // GET  /users/:email/home
r.post("/join",       joinHome);            // POST /users/join     { email, homeId }
r.post("/leave",      leaveHome);           // POST /users/leave    { email, homeId }

// Authenticated self-delete
r.delete("/me", verifySupabaseToken, deleteMe); // DELETE /users/me

export default r;
