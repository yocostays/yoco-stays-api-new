import { Router } from "express";
import QRController from "../controllers/qr.controller";
import validateToken from "../middlewares/validateToken";
import { validateZod } from "../middlewares/validateZod";
import { validateWardenHostelAccess } from "../middlewares/validateWardenHostelAccess";
import { GenerateQRSchema } from "../utils/validators/qr.validator";

const { generateQR } = QRController;

const qrRouter = Router();

// Generate QR
qrRouter.post(
  "/warden/generate",
  validateZod(GenerateQRSchema),
  validateToken,
  validateWardenHostelAccess,
  generateQR
);

export default qrRouter;
