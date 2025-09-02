import { Router } from "express";
import LeaveReportController from "../controllers/leaveReport.controller";
import validateToken from "../middlewares/validateToken";
const {
  leaveReportCountSummary,
  leaveGraphCountSummary,
  leaveGraphReportExport,
  exportLeaveDetails
} = LeaveReportController;

const leveReportRouter = Router();

leveReportRouter.post("/summary", validateToken, leaveReportCountSummary);
leveReportRouter.post("/count", validateToken, leaveGraphCountSummary);
leveReportRouter.post("/graph-export", validateToken, leaveGraphReportExport);
leveReportRouter.post("/export", validateToken, exportLeaveDetails);

export default leveReportRouter;
