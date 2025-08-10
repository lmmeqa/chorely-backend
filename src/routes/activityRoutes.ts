import { Router } from "express";
import { Chore } from "../db/models";

const r = Router();

r.get("/", async (req, res) => {
  const homeId = req.query.homeId as string;
  const timeFrame = req.query.timeFrame as string || "7d"; // default to 7 days
  
  // Calculate the date threshold based on timeFrame
  const now = new Date();
  let threshold: Date;
  
  switch (timeFrame) {
    case "1d":
      threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      threshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      threshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      threshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  const query = Chore.recentActivity(threshold);
  if (homeId) {
    query.where({ home_id: homeId });
  }
  
  res.json(await query);
});

export default r;