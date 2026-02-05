import { Router } from "express";
import DashboardController from "../controllers/dashboard.controller";
import validateToken from "../middlewares/validateToken";

const {
  wardenDashboardDetails,
  userDashboardDetails,
  getAnnouncementsForStudentDashboard,
} = DashboardController;

const dashboardRouter = Router();

dashboardRouter.post("/warden", validateToken, wardenDashboardDetails);
dashboardRouter.post("/user", validateToken, userDashboardDetails);

// get announcements for student dashboard
dashboardRouter.get(
  "/user/announcements",
  validateToken,
  getAnnouncementsForStudentDashboard,
);

export default dashboardRouter;
