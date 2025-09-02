import { Router } from "express";
import AuthController from "../controllers/auth.controller";
import validateToken from "../middlewares/validateToken";
import { uploadFileWithMulter } from "../utils/configureMulterStorage";
const {
  staffLoginWithUserNameAndPwd,
  studentLoginWithIdAndPwd,
  logoutFromApplication,
  resetStudentPasswordInApp,
  uploadImageOrAudio,
  generateWardenRefreshToken,
  generateOtpForApp,
  generateOtpForwardenPanel,
  resetStaffPassword,
  downloadSampleBulkUploadFile,
  generateOtpUserSignUp,
  verifyOtpUserSignUp,
} = AuthController;

const authRouter = Router();

authRouter.post("/signin", staffLoginWithUserNameAndPwd);
authRouter.post("/sessions", studentLoginWithIdAndPwd);
authRouter.post("/logout", validateToken, logoutFromApplication);
authRouter.post("/student-reset-password", resetStudentPasswordInApp);
authRouter.post(
  "/upload-media",
  uploadFileWithMulter.single("file"),
  validateToken,
  uploadImageOrAudio
);
authRouter.post("/refresh-token", validateToken, generateWardenRefreshToken);
authRouter.post("/request-otp", generateOtpForApp);
authRouter.post("/staff/generate-otp", generateOtpForwardenPanel);
authRouter.post("/staff/reset-password", resetStaffPassword);
authRouter.post(
  "/sample-files/download",
  validateToken,
  downloadSampleBulkUploadFile
);
authRouter.post("/generate-otp", validateToken, generateOtpUserSignUp);
authRouter.post("/verify-otp", validateToken, verifyOtpUserSignUp);

export default authRouter;
