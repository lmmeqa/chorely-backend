/**
 * Express sub-router – keeps the main entry uncluttered.
 * URL prefix is determined in `index.ts`.
 */

import { Router } from "express";
import * as u from "../controllers/userController";

const router = Router();


router.post("/create", u.create)

// router.get("/", (_, res) =>{ res.send("backend is working")});
// router.get("/my", c.myChores);
// router.get("/available", c.available);
// router.get("/unapproved", c.unapproved);

// router.get("/:uuid", c.getById);
// router.post("/:uuid/approve", c.approve);
// router.post("/:uuid/claim", c.claim);
// router.post("/:uuid/complete", c.complete);
// router.post("/:uuid/verify", c.verify);
export default router