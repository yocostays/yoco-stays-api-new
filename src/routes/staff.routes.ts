import { Router } from "express";
import SaffController from "../controllers/staff.controller";
import validateToken from "../middlewares/validateToken";
const {
  getAllStaffsWithPagination,
  getStaffDetailsById,
  assignHostelToWarden,
  getHostelOfTheWarden,
  deleteStaffById,
  updateStaffDetailsById,
  getAllMaintanceStaffs,
  createNewStaff,
  fetchStaffDetailsByIdAndType,
  indisciplinaryActionUpdate,
  inactiveStaff,
  fetchAllStaffForWarden,
  checkUsernameExists,
  fetchStaffActiveHostelDetails
} = SaffController;

const staffRouter = Router();

staffRouter.post("/create-from-warden", validateToken, createNewStaff);
staffRouter.get("/", validateToken, getAllStaffsWithPagination);
staffRouter.get("/all", validateToken, fetchAllStaffForWarden);
staffRouter.get("/:id", validateToken, getStaffDetailsById);
staffRouter.post("/assign-hostel", validateToken, assignHostelToWarden);
staffRouter.post("/get-assign-hostel", validateToken, getHostelOfTheWarden);
staffRouter.delete("/delete/:id", validateToken, deleteStaffById);
staffRouter.patch("/update/:id", validateToken, updateStaffDetailsById);
staffRouter.post("/maintenance-list", validateToken, getAllMaintanceStaffs);
staffRouter.post("/profile/type", validateToken, fetchStaffDetailsByIdAndType); //TODO - only use in admin and warden
staffRouter.patch(
  "/update-indisciplinary",
  validateToken,
  indisciplinaryActionUpdate
); //TODO - only use in warden panel
staffRouter.post("/inactive", validateToken, inactiveStaff);
staffRouter.post("/username-exists", validateToken, checkUsernameExists);
staffRouter.post("/active-hostel", validateToken, fetchStaffActiveHostelDetails);

export default staffRouter;
