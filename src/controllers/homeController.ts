import { Home, User } from "../db/models";
import { controller } from "../middleware";


export const createHome = controller(async (req, res) => {
  const home = await Home.create(req.body.name);
  res.status(201).json(home);
});

export const getHomeById = controller(async (req, res) => {
  const home = await Home.findById(req.params.id);
  res.json(home);
});

export const listHomes = controller(async (_req, res) => {
  res.json(await Home.all());
});

export const getHomeUsers = controller(async (req, res) => {
  const users = await User.byHome(req.params.id);
  res.json(users);
});

export const updateWeeklyQuota = controller(async (req, res) => {
  const { weeklyPointQuota, weekly_point_quota } = req.body;
  const quota = weeklyPointQuota ?? weekly_point_quota;
  await Home.updateWeeklyQuota(req.params.id, quota);
  res.json({ weeklyPointQuota: quota });
});