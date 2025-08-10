import { Router } from "express";
import { getStatus, vote, unvote } from "../controllers/approvalController";

const r = Router();

r.get("/:uuid", getStatus);              // GET /approvals/:uuid
r.post("/:uuid/vote", vote);             // POST /approvals/:uuid/vote { userEmail }
r.post("/:uuid/unvote", unvote);         // POST /approvals/:uuid/unvote { userEmail }

export default r;