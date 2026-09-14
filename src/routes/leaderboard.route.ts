import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { leaderboardController } from "../controllers/leaderboard.controller";
import {
  leaderboardQuerySchema,
  leaderboardPrivacySchema,
} from "../validators/leaderboard.validator";
import { catchAsync } from "../utils/catchAsync";
const r = Router();
r.get(
  "/",
  authenticate,
  validate(leaderboardQuerySchema),
  catchAsync(leaderboardController.list),
);
r.get("/privacy", authenticate, catchAsync(leaderboardController.privacyGet));
r.patch(
  "/privacy",
  authenticate,
  validate(leaderboardPrivacySchema),
  catchAsync(leaderboardController.privacySet),
);
export default r;
