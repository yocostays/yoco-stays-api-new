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
  deleteUsers,
  userDeleteRequest,
  updateUserFromApp,
  userVerifyOtp,
  userRequestDeactivate,
  generateOtpForAccountChange,
  verifyOtpForAccountChange,
  sendTempPassword
} = UserController;

const userRouter = Router();
// ========== Mobile App Routes (Student & Staff) ==========
// Routes primarily used by the mobile application (students and mobile staff)
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
userRouter.post("/send-credentials",validateToken, sendTempPassword)//This route is used for warden can send password to user
// ========== Web App Routes (Warden / Admin / Warden Panel) ==========
// Routes used by the warden/admin panel or web clients
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
userRouter.patch("student/update/:id", validateToken, updateUserFromApp); //TODO - use in warden panel for update student
userRouter.post(
  "/hostel-academic",
  validateToken,
  fetchUsersBasedOnHostelAndAcademic
); //TODO - use in warden panel for fetch users
userRouter.post("/update-status", validateToken, updateUserStatus);
userRouter.delete("/:id", validateToken, deleteUsers);
userRouter.post("/request-account-deletion", userDeleteRequest);
userRouter.post("/request-otp-verify", userVerifyOtp); //verify otp for app and otp varify account delete for user
userRouter.patch("/request-account-deactivate", userRequestDeactivate);
export default userRouter;


//endpoints for change mail id and phone number otp request in app
userRouter.post("/update/request-otp", validateToken, generateOtpForAccountChange);
userRouter.post(
  "/update/verify-otp",
  validateToken,
  verifyOtpForAccountChange 
);