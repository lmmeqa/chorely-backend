/**
 * Thin request-handlers: validate/augment input,
 * call model functions, shape HTTP response.
 */

import { Request, Response } from "express";
import * as model from "../models/choreModel";

/* ---------- POST /chores ---------- */
export const create = async (req: Request, res: Response) => {
  try {
    const chore = await model.createChore(req.body);
    res.status(201).json(chore);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
};

/* ---------- GET /chores/my ---------- */
export const myChores = async (req: Request, res: Response) => {
  res.json(await model.listByStatus("claimed", req.body.email));
};

/* ---------- GET /chores/available ---------- */
export const available = async (_: Request, res: Response) => {
  res.json(await model.listByStatus("unclaimed"));
};

export const unapproved = async (_: Request, res: Response) => {
  res.json(await model.listByStatus("unapproved"));
};

/* ---------- GET /chores/:uuid ---------- */
export const getById = async (req: Request, res: Response) => {
  const chore = await model.getChore(req.params.uuid);
  chore ? res.json(chore) : res.status(404).end();
};

/* ---------- State-transition helpers ---------- */
export const approve  = async (req:Request, res:Response) => res.json(
  await model.updateStatus(req.params.uuid, "unclaimed")
);

export const claim = async (req:Request, res:Response) => res.json(
  await model.updateStatus(
    req.params.uuid, "claimed", req.body.email
  )
);

export const complete = async (req:Request, res:Response) => res.json(
  await model.updateStatus(req.params.uuid, "complete")
);

export const verify = complete; // same semantics for now
