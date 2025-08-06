import { Router } from "express";
import {
  createUser,
  loginUser,
  getUserHomes,
  joinHome,
} from "../controllers/userController";

const r = Router();

r.post("/",           createUser);          // POST /users          { email, homeIds[] }
r.post("/login",      loginUser);           // POST /users/login    { email }
r.get ("/:email/home", getUserHomes);       // GET  /users/:email/home
r.post("/join",       joinHome);            // POST /users/join     { email, homeId }

export default r;
