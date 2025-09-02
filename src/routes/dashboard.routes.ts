import { Router } from "express";
import DashboardController from "../controllers/dashboard.controller";
import validateToken from "../middlewares/validateToken";

const { wardenDashboardDetails, userDashboardDetails } = DashboardController;

const dashboardRouter = Router();

dashboardRouter.post("/warden", validateToken, wardenDashboardDetails);
dashboardRouter.post("/user", validateToken, userDashboardDetails);

export default dashboardRouter;
