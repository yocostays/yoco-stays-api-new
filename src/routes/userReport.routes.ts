import { Router } from "express";
import validateToken from "../middlewares/validateToken";
import UserReportController from "../controllers/userReport.controller";

const {
  getUserCountReport,
  totalStudentAndStaffCount,
  graphReportExport,
  exportStudentDetailsByIdAndType,
  exportStudentDetails,
} = UserReportController;

const userReportRouter = Router();

userReportRouter.post("/", validateToken, getUserCountReport);
userReportRouter.post("/summary", validateToken, totalStudentAndStaffCount);
userReportRouter.get("/export", validateToken, graphReportExport);
userReportRouter.post(
  "/export-details",
  validateToken,
  exportStudentDetailsByIdAndType
);
userReportRouter.post("/export-all", validateToken, exportStudentDetails);

export default userReportRouter;
