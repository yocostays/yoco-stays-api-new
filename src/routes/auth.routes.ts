import { Router } from "express";
import AuthController from "../controllers/auth.controller";
import validateToken from "../middlewares/validateToken";
import { uploadFileWithMulter } from "../utils/configureMulterStorage";
import {
  otpGenerationRateLimiter,
  otpVerificationRateLimiter,
} from "../middlewares/otpRateLimiter";
import { validateZod } from "../middlewares/validateZod";
import {
  requestOtpSchema,
  resetPasswordSchema,
} from "../utils/validators/otp.schema";
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

// Mobile upload (image/audio) used by staff and students (requires token)
authRouter.post(
  "/upload-media",
  uploadFileWithMulter.single("file"),
  validateToken,
  uploadImageOrAudio
);

// ========== Web App Routes (Warden / Admin / Warden Panel) ==========
// Warden: refresh token (warden panel)
authRouter.post("/refresh-token", validateToken, generateWardenRefreshToken);

// Warden panel: generate OTP for staff via web
// Warden panel: generate OTP for staff (dual-layer protection)
authRouter.post(
  "/staff/generate-otp",
  otpGenerationRateLimiter,
  generateOtpForwardenPanel
);

// Web: staff password reset (via admin/warden panel)
authRouter.post("/staff/reset-password", resetStaffPassword);

// Web: download sample bulk-upload files (requires auth)
authRouter.post(
  "/sample-files/download",
  validateToken,
  downloadSampleBulkUploadFile
);

// Web: generate/verify OTP for user signup in warden/admin panel
// Web: generate/verify OTP for user signup (dual-layer protection)
authRouter.post(
  "/generate-otp",
  validateToken,
  otpGenerationRateLimiter,
  generateOtpUserSignUp
);
authRouter.post(
  "/verify-otp",
  validateToken,
  otpVerificationRateLimiter,
  verifyOtpUserSignUp
);

//------------------------------- Mobile app side APIs----------------------------------------------

// Mobile: request OTP
authRouter.post(
  "/request-otp",
  otpGenerationRateLimiter,
  validateZod(requestOtpSchema),
  generateOtpForApp
);

// Student reset password - verification protected
authRouter.post(
  "/student-reset-password",
  otpVerificationRateLimiter,
  validateZod(resetPasswordSchema),
  resetStudentPasswordInApp
);

export default authRouter;
