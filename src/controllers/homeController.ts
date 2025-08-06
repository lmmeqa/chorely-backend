import { Request, Response } from "express";
import Home from "../db/models/Home";
import { controller } from "./.controller";

export const createHome = controller(async (req: Request, res: Response) => {
  const home = await Home.create(req.body.name, req.body.address);
  res.status(201).json(home);
});

export const getHome = controller(async (req: Request, res: Response) => {
  const home = await Home.findById(req.body.id);
  res.json(home); // 200 OK by default
});

export const getAllHomes = controller(async (_: Request, res: Response) => {
  const home = await Home.all();
  res.json(home); // 200 OK by default
});


