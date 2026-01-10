import { Router } from "express";
import QRController from "../controllers/qr.controller";
import validateToken from "../middlewares/validateToken";
import { validateZod } from "../middlewares/validateZod";
import { validateWardenHostelAccess } from "../middlewares/validateWardenHostelAccess";
import { validateStudent } from "../middlewares/validateStudent";
import { GenerateQRSchema, ScanQRSchema, GetActiveQRsSchema } from "../utils/validators/qr.validator";

const { generateQR, scanQR, getActiveQR } = QRController;

const qrRouter = Router();

// Endpoint for warden to generate/refresh QR
qrRouter.post(
  "/warden/generate",
  validateZod(GenerateQRSchema),
  validateToken,
  validateWardenHostelAccess,
  generateQR
);

// Endpoint to get EXISTING active QR (No rotation)
qrRouter.post(
  "/warden/active-qr",
  validateZod(GetActiveQRsSchema),
  validateToken,
  validateWardenHostelAccess,
  getActiveQR
);


//Endpoint for user to scan QR
qrRouter.post(
  "/user/scan",
  validateToken,
  validateStudent,
  validateZod(ScanQRSchema),
  scanQR
);

export default qrRouter;
