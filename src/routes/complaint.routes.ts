import { Router } from "express";
import ComplainController from "../controllers/complaint.controller";
import validateToken from "../middlewares/validateToken";

const {
  createNewComplainInApp,
  getAllComplaintByStatus,
  assignMaintanceStaffs,
  compaintStatusUpdate,
  getUserComplaintByStatus,
  getComplaintLogs,
  cancelComplaintById,
  getStudentComplaintById,
  individualStudentComplaints,
  bulkUpdateComplainStatus
} = ComplainController;

const complaintRouter = Router();

complaintRouter.post("/create", validateToken, createNewComplainInApp);
complaintRouter.get("/", validateToken, getAllComplaintByStatus);
complaintRouter.get("/:id", validateToken, getStudentComplaintById);
complaintRouter.post("/allocate-staff", validateToken, assignMaintanceStaffs);
complaintRouter.patch("/update-status", validateToken, compaintStatusUpdate);
complaintRouter.post("/user/status", validateToken, getUserComplaintByStatus);
complaintRouter.post("/logs", validateToken, getComplaintLogs);
complaintRouter.post("/cancel", validateToken, cancelComplaintById);
complaintRouter.post("/individual-complaint", validateToken, individualStudentComplaints);
complaintRouter.patch("/bulk-update", validateToken, bulkUpdateComplainStatus);

export default complaintRouter;
