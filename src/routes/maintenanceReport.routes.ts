import { Router } from "express";
import MaintenanceReportController from "../controllers/maintenanceReport.controller";

const {
  topMaintenanceCategoryList,
  maintenanceSummaryReport,
  totalComplaintCounts,
  complaintResolutionMetrics,
  exportComplaintDetails,
} = MaintenanceReportController;

import validateToken from "../middlewares/validateToken";

const maintenanceReportRouter = Router();

maintenanceReportRouter.post(
  "/top-category",
  validateToken,
  topMaintenanceCategoryList
);
maintenanceReportRouter.post(
  "/summary",
  validateToken,
  maintenanceSummaryReport
);
maintenanceReportRouter.post("/overview", validateToken, totalComplaintCounts);
maintenanceReportRouter.post(
  "/resolution-metrics",
  validateToken,
  complaintResolutionMetrics
);
maintenanceReportRouter.post("/export", validateToken, exportComplaintDetails);

export default maintenanceReportRouter;
