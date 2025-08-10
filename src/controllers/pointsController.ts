import { controller } from "./.controller";
import { Points } from "../db/models";
import { db } from "../db/models";

export const getAll = controller(async (req, res) => {
  res.json(await Points.getAll(req.params.homeId));
});

export const getForUser = controller(async (req, res) => {
  const { homeId, email } = req.params;
  res.json({ points: await Points.get(homeId, email) });
});

export const addForUser = controller(async (req, res) => {
  const { homeId, email } = req.params;
  const { delta } = req.body as { delta: number };
  res.json({ points: await Points.add(homeId, email, Number(delta || 0)) });
});

export const setWeeklyQuota = controller(async (req, res) => {
  const { weeklyPointQuota } = req.body as { weeklyPointQuota: number };
  await db("homes").where({ id: req.params.homeId }).update({ weekly_point_quota: weeklyPointQuota });
  res.json({ weeklyPointQuota });
});

export const updateUserPoints = controller(async (req, res) => {
  const { homeId, email } = req.params;
  const { points } = req.body as { points: number };
  const newPoints = await Points.add(homeId, email, points);
  res.json({ points: newPoints });
});