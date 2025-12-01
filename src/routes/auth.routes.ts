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
// ========== Mobile App Routes (Staff & Student) ==========
// Staff (mobile) login
authRouter.post("/signin", staffLoginWithUserNameAndPwd);

// Student (mobile) login/session
authRouter.post("/sessions", studentLoginWithIdAndPwd);

// Shared: logout (requires token) — used by mobile clients
authRouter.post("/logout", validateToken, logoutFromApplication);

// Student (mobile) reset password
authRouter.post("/student-reset-password", resetStudentPasswordInApp);//for app studen rest password

// Mobile upload (image/audio) used by staff and students (requires token)
authRouter.post(
  "/upload-media",
  uploadFileWithMulter.single("file"),
  validateToken,
  uploadImageOrAudio
);

// Mobile: request OTP (app)
authRouter.post("/request-otp", generateOtpForApp);//for app

// ========== Web App Routes (Warden / Admin / Warden Panel) ==========
// Warden: refresh token (warden panel)
authRouter.post("/refresh-token", validateToken, generateWardenRefreshToken);

// Warden panel: generate OTP for staff via web
authRouter.post("/staff/generate-otp", generateOtpForwardenPanel);//warden panel

// Web: staff password reset (via admin/warden panel)
authRouter.post("/staff/reset-password", resetStaffPassword);

// Web: download sample bulk-upload files (requires auth)
authRouter.post(
  "/sample-files/download",
  validateToken,
  downloadSampleBulkUploadFile
);

// Web: generate/verify OTP for user signup in warden/admin panel
authRouter.post("/generate-otp", validateToken, generateOtpUserSignUp);
authRouter.post("/verify-otp", validateToken, verifyOtpUserSignUp);

export default authRouter;
