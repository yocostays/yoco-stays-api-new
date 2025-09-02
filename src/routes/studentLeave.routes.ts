import { Router } from "express";
import StudentLeaveController from "../controllers/studentLeave.controller";
import validateToken from "../middlewares/validateToken";

const {
  studentApplyLeave,
  getUserLeaveByStatus,
  getLeaveLogs,
  getAllLeaveInwardenPanelOrAdmin,
  getLeaveById,
  updateLeaveStatusById,
  studentApplyOuting,
  gatepassDetailsForApp,
  cancelComplaintById,
  fetchIndividualUserLeaveDetails,
  bulkUpdateLeaveStatus,
  retrieveStudentCurrentlyOut,
} = StudentLeaveController;

const studentLeaveRouter = Router();

studentLeaveRouter.get("/", validateToken, getAllLeaveInwardenPanelOrAdmin);
studentLeaveRouter.get("/app", validateToken, getUserLeaveByStatus); //TODO - use in student app
studentLeaveRouter.get(
  "/individual",
  validateToken,
  fetchIndividualUserLeaveDetails
); //TODO - fetch Indivisual User Leave Details
studentLeaveRouter.get("/:id", validateToken, getLeaveById);
studentLeaveRouter.post("/apply", validateToken, studentApplyLeave); //TODO - use in student app
studentLeaveRouter.post("/logs", validateToken, getLeaveLogs); //TODO - use in student app
studentLeaveRouter.patch("/update/:id", validateToken, updateLeaveStatusById);
studentLeaveRouter.post("/outings/request", validateToken, studentApplyOuting); //TODO - use in student app
studentLeaveRouter.post(
  "/get-gatepass-info",
  validateToken,
  gatepassDetailsForApp
); //TODO - use in student app
studentLeaveRouter.post("/cancel", validateToken, cancelComplaintById); //TODO - use in student app
studentLeaveRouter.patch("/bulk-update", validateToken, bulkUpdateLeaveStatus);
studentLeaveRouter.post(
  "/currently-out",
  validateToken,
  retrieveStudentCurrentlyOut
);

export default studentLeaveRouter;
