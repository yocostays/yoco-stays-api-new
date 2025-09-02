import { Router } from "express";
import MessMenuController from "../controllers/mess.controller";
const {
  createMessMenuForHostel,
  getAllMessMenuWithPagination,
  getMenudetailsById,
  deleteHosetelMessMenuById,
  updateHostelMessMenuDetailsById,
  getTodayMenudetailsOfHostel,
  bookMealByStudent,
  cancelBookingMealByStudent,
  fetchCancelledMeals,
  messMenuBulkUpload,
  bookingReversible,
  editMealByStudent,
  getMealBookedDates,
  getBookedMealDetails,
  getBookMealById,
  fetchIndividualBookMealDetails,
  fetchGatepassInfoByMealId,
  manuallyBookMeal,
  fetchManuallyBookedMeals
} = MessMenuController;
import validateToken from "../middlewares/validateToken";
import { uploadFileWithMulter } from "../utils/configureMulterStorage";

const messMenuRouter = Router();

//Book Meal
messMenuRouter.get("/missed-booking", validateToken, fetchManuallyBookedMeals);
messMenuRouter.get("/book-meal/individual", validateToken, fetchIndividualBookMealDetails);
messMenuRouter.get("/details", validateToken, getBookedMealDetails);
messMenuRouter.get("/book-meal/:id", validateToken, getBookMealById);
messMenuRouter.post("/get-gatepass-info", validateToken, fetchGatepassInfoByMealId);

messMenuRouter.post("/create", validateToken, createMessMenuForHostel);
messMenuRouter.get("/", validateToken, getAllMessMenuWithPagination);
messMenuRouter.get("/:id", validateToken, getMenudetailsById);
messMenuRouter.delete("/delete", validateToken, deleteHosetelMessMenuById);
messMenuRouter.patch(
  "/update/:id",
  validateToken,
  updateHostelMessMenuDetailsById
);
messMenuRouter.post("/today-menu", validateToken, getTodayMenudetailsOfHostel);
messMenuRouter.post("/meal-booking", validateToken, bookMealByStudent);
messMenuRouter.post(
  "/cancel-booking",
  validateToken,
  cancelBookingMealByStudent
);
messMenuRouter.post(
  "/canceled-meal-history",
  validateToken,
  fetchCancelledMeals
); //TODO - fetch Cancelled Meals and booked status
messMenuRouter.post(
  "/bulk-upload",
  uploadFileWithMulter.single("file"),
  validateToken,
  messMenuBulkUpload
);
messMenuRouter.post("/reversibility", validateToken, bookingReversible);
messMenuRouter.post("/edit-meal", validateToken, editMealByStudent);
messMenuRouter.post("/booked/date", validateToken, getMealBookedDates);
messMenuRouter.post("/booked/manual", validateToken, manuallyBookMeal);

export default messMenuRouter;
