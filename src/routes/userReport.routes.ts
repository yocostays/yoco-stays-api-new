import { Router } from "express";
import validateToken from "../middlewares/validateToken";
import { checkSuperAdmin } from "../middlewares/checkSuperAdmin";
import UserReportController from "../controllers/userReport.controller";

const {
  getUserCountReport,
  totalStudentAndStaffCount,
  graphReportExport,
  exportStudentDetailsByIdAndType,
  exportStudentDetails,
  fetchUsersByCategory,
} = UserReportController;

const userReportRouter = Router();

userReportRouter.post("/", validateToken, getUserCountReport);
userReportRouter.post("/summary", validateToken, totalStudentAndStaffCount);
userReportRouter.get("/export", validateToken, graphReportExport);
userReportRouter.post(
  "/export-details",
  validateToken,
  exportStudentDetailsByIdAndType,
);
userReportRouter.post("/export-all", validateToken, exportStudentDetails);

//fetch users by category (student, staff, etc.) for reporting purposes
userReportRouter.post(
  "/fetch-by-category",
  validateToken,
  checkSuperAdmin,
  fetchUsersByCategory,
);

export default userReportRouter;
