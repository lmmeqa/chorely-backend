// src/controllers/userController.ts
import { controller } from "../middleware";
import { User } from "../db/models";
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/supabaseAuth";
import supabase from "../lib/supabase";

export const createUser = controller(async (req, res) => {
  const user = await User.create(req.body.email, req.body.homeIds, req.body.name); // homeIds: string[]
  res.status(201).json(user);
});

export const loginUser = controller(async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  res.json(user);                                  // 200
});

export const getUserHomes = controller(async (req, res) => {
  const user = await User.findByEmail(req.params.email);
  const homes = await User.homes(user.email)
  res.json(homes);
});

export const joinHome = controller(async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  await User.joinHome(user.email, req.body.homeId);
  res.status(204).end();
});

// in controllers/userController.ts
export const leaveHome = controller(async (req, res) => {
  const { email, homeId } = req.body;
  const user = await User.findByEmail(email);
  await User.leaveHome(user.email, homeId);
  res.status(204).end();
});

export const getByEmail = controller(async (req, res) => {
  // throws USER_NOT_FOUND if not present
  const user = await User.findByEmail(req.params.email);
  res.json(user);
});

// Hard-delete a user and related rows; also delete Supabase auth user (service key)
export const deleteMe = controller(async (req: AuthenticatedRequest, res: Response) => {
  const authedEmail = req.user?.email;
  if (!authedEmail) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Best-effort: delete Supabase auth user by email if we know their user id
  try {
    // Lookup our user row (may contain supabase_user_id in future)
    const user = await User.findByEmail(authedEmail);
    // Attempt delete by email via admin API: get user by email then delete
    const { data: users } = await (supabase as any).auth.admin.listUsers();
    const match = users?.users?.find((u: any) => (u?.email || "").toLowerCase() === authedEmail);
    if (match?.id) {
      await (supabase as any).auth.admin.deleteUser(match.id);
    }
    // Ignore failures – continue to purge our database regardless
  } catch {}

  // Our schema uses email PK and cascades on FKs where appropriate
  // Remove all user associations then the user row
  // user_homes has ON DELETE CASCADE, disputes/approvals as well
  await (await import("../db/models")).default.transaction(async (trx: any) => {
    await trx("chore_approvals").where({ user_email: authedEmail }).del();
    await trx("disputes").where({ disputer_email: authedEmail }).del();
    await trx("user_homes").where({ user_email: authedEmail }).del();
    await trx("users").where({ email: authedEmail }).del();
  });

  return res.status(204).end();
});