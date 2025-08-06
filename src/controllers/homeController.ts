import Home from "../db/models/Home";
import { controller } from "./.controller";


export const createHome = controller(async (req, res) => {
  const home = await Home.create(req.body.name, req.body.address);
  res.status(201).json(home);
});

export const getHomeById = controller(async (req, res) => {
  const home = await Home.findById(req.params.id);
  res.json(home);
});

export const listHomes = controller(async (_req, res) => {
  res.json(await Home.all());
});



