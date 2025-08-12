import { Router } from "express";
import { Chore } from "../db/models";

const r = Router();

r.get("/", async (req, res) => {
  const homeId = req.query.homeId as string;
  const timeFrame = req.query.timeFrame as string || "3d"; // default to 3 days
  
  // Calculate the date threshold based on timeFrame
  const now = new Date();
  let threshold: Date;
  
  switch (timeFrame) {
    case "1d":
      threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "3d":
      threshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      break;
    case "7d":
      threshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      threshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      threshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  }
  
  const results = await Chore.recentActivity(threshold, homeId);
  console.log('Recent activities raw results:', results.map(r => ({ 
    id: r.uuid, 
    name: r.name, 
    completed_at: r.completed_at,
    status: r.status 
  })));
  
  res.json(results);
});

export default r;