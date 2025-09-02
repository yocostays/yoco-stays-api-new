import { Router } from "express";
import UserController from "../controllers/user.controller";
import validateToken from "../middlewares/validateToken";
import { uploadFileWithMulter } from "../utils/configureMulterStorage";

const {
  registerUserFromApp,
  getUsersWithoutHostelAllocation,
  getStudentDetailsById,
  getAllUsersWithPagination,
  assignHostelIndivisually,
  updateStudentDetailsForApp,
  retrieveStudentDetailsByIdForApp,
  updateStudentVechicleDetailsForApp,
  getStudentDetailsByUniqueId,
  uploadKycDocuments,
  fetchStudentDetailsByIdAndType,
  updateAuthorizedUser,
  registerUserFromWardenPanel,
  indisciplinaryActionUpdate,
  userBulkUpload,
  deleteUserVehicleDetails,
  updateUserFromWardenPanel,
  fetchUsersBasedOnHostelAndAcademic,
  updateUserStatus,
} = UserController;

const userRouter = Router();

userRouter.post("/register", registerUserFromApp);
userRouter.get("/", validateToken, getAllUsersWithPagination);
userRouter.get(
  "/no-hostel-allocation",
  validateToken,
  getUsersWithoutHostelAllocation
);

userRouter.get("/:id", validateToken, getStudentDetailsById);
userRouter.post("/assign-hostel", validateToken, assignHostelIndivisually);
userRouter.post("/profile/update", validateToken, updateStudentDetailsForApp); //TODO - only use in app for(email and image update)
userRouter.post("/profile", validateToken, retrieveStudentDetailsByIdForApp); //TODO - only use in app for
userRouter.patch(
  "/sync-vehicle",
  validateToken,
  updateStudentVechicleDetailsForApp
); //TODO - only use in app for
userRouter.patch(
  "/update-indisciplinary",
  validateToken,
  indisciplinaryActionUpdate
); //TODO - only use in warden panel
userRouter.post("/info-by-yoco-id", validateToken, getStudentDetailsByUniqueId);
userRouter.post(
  "/upload-kyc",
  uploadFileWithMulter.single("file"),
  validateToken,
  uploadKycDocuments
); //TODO - only use in app for

userRouter.post(
  "/upload-kyc-admin",
  uploadFileWithMulter.single("file"),
  validateToken,
  uploadKycDocuments
); //TODO - only use in warden panel for
userRouter.post("/profile/type", validateToken, fetchStudentDetailsByIdAndType); //TODO - only use in admin and warden
userRouter.post("/update/authorized", validateToken, updateAuthorizedUser);
userRouter.post("/create-resident", validateToken, registerUserFromWardenPanel); //TODO - only use in warden panel
userRouter.post(
  "/bulk-upload",
  uploadFileWithMulter.single("file"),
  validateToken,
  userBulkUpload
); //TODO - only use in warden panel for
userRouter.delete("/vehicle/:id", validateToken, deleteUserVehicleDetails);
userRouter.patch("/update/:id", validateToken, updateUserFromWardenPanel); //TODO - use in warden panel for update student
userRouter.post(
  "/hostel-academic",
  validateToken,
  fetchUsersBasedOnHostelAndAcademic
); //TODO - use in warden panel for fetch users
userRouter.post("/update-status", validateToken, updateUserStatus);

export default userRouter;
