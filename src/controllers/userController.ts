/**
 * Thin request-handlers: validate/augment input,
 * call model functions, shape HTTP response.
 */

import { Request, Response } from "express";
import * as userModel from "../models/userModel";

/* ---------- POST /chores ---------- */
export const create = async (req: Request, res: Response) => {
  try {
    const user = await userModel.createUser(req.body);
    res.status(201).json(user);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
};

// /* ---------- GET /chores/my ---------- */
// export const myChores = async (req: Request, res: Response) => {
//   res.json(await choreModel.listByStatus("claimed", req.body.email));
// };

// /* ---------- GET /chores/available ---------- */
// export const available = async (_: Request, res: Response) => {
//   res.json(await choreModel.listByStatus("unclaimed"));
// };

// export const unapproved = async (_: Request, res: Response) => {
//   res.json(await choreModel.listByStatus("unapproved"));
// };

// /* ---------- GET /chores/:uuid ---------- */
// export const getById = async (req: Request, res: Response) => {
//   const chore = await choreModel.getChore(req.params.uuid);
//   chore ? res.json(chore) : res.status(404).end();
// };

// /* ---------- State-transition helpers ---------- */
// export const approve  = async (req:Request, res:Response) => res.json(
//   await choreModel.updateStatus(req.params.uuid, "unclaimed")
// );

// export const claim = async (req:Request, res:Response) => res.json(
//   await choreModel.updateStatus(
//     req.params.uuid, "claimed", req.body.email
//   )
// );

// export const complete = async (req:Request, res:Response) => res.json(
//   await choreModel.updateStatus(req.params.uuid, "complete")
// );

// export const verify = complete; // same semantics for now
