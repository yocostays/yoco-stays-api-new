import { Router } from "express";
import validateToken from "../middlewares/validateToken";
import FoodWastageReportController from "../controllers/foodWastageReport.controller";

const { foodWastageReport, exportFoodWastageDetails } =
  FoodWastageReportController;

const foodWastageReportRouter = Router();

foodWastageReportRouter.post("/graph", validateToken, foodWastageReport);
foodWastageReportRouter.post(
  "/export",
  validateToken,
  exportFoodWastageDetails
);

export default foodWastageReportRouter;
