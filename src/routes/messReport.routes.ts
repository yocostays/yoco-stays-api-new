import { Router } from "express";
import MessReportController from "../controllers/messReport.controller";
const {
  messCountReport,
  consumedMealsList,
  consumedMealsListExport,
  exportBooKMealDetails,
  exportMessMenuDetails,
  exportMissedBookingDetails,
} = MessReportController;
import validateToken from "../middlewares/validateToken";

const messReportRouter = Router();

messReportRouter.post("/summary", validateToken, messCountReport);
messReportRouter.post("/consumed-meals", validateToken, consumedMealsList);
messReportRouter.post(
  "/consumed-meals/export",
  validateToken,
  consumedMealsListExport
);
messReportRouter.post(
  "/book-meal/export",
  validateToken,
  exportBooKMealDetails
); //Export for book-meal
messReportRouter.post(
  "/mess-menu/export",
  validateToken,
  exportMessMenuDetails
); //Export for mess-menu
messReportRouter.post(
  "/missed-booking/export",
  validateToken,
  exportMissedBookingDetails
); //Export for manually booking data

export default messReportRouter;
