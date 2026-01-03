import { Router } from "express";
import MessMenuController from "../controllers/mess.controller";
const {
  createMessMenuForHostel,
  getAllMessMenuWithPagination,
  getMenudetailsById,
  deleteHosetelMessMenuById,
  updateHostelMessMenuDetailsById,
  getTodayMenudetailsOfHostel,
  bookMealByStudentOld,
  bookMealByStudent,
  getMonthlyMealData,
  cancelBookingMealByStudent,
  // fetchCancelledMeals,
  messMenuBulkUpload,
  bookingReversible,
  editMealByStudent,
  getMealBookedDates,
  getBookedMealDetails,
  getBookMealById,
  fetchIndividualBookMealDetails,
  fetchGatepassInfoByMealId,
  manuallyBookMeal,
  fetchManuallyBookedMeals,
  setHostelMealTiming,
  getMealStateAnalyticsByDate,
  getStudentsMealStatusByDate,
  getHostelMealTiming,
  setHostelMealCutoff,
  getHostelMealCutoff,
} = MessMenuController;
import validateToken from "../middlewares/validateToken";
import { validateZod } from "../middlewares/validateZod";
import {
  SetMealTimingSchema,
  GetMealTimingSchema,
} from "../utils/validators/mealTiming.validator";
import {
  SetMealCutoffSchema,
  GetMealCutoffSchema,
} from "../utils/validators/mealCutoff.validator";
import {
  BulkMealBookingSchema,
  CalendarMonthViewSchema,
  CreateMessMenuSchema,
  MealStateAnalyticsSchema,
  MessMenuPaginationSchema,
} from "../utils/validators/mealBooking.validator";
import { WardenMealReportingSchema } from "../utils/validators/wardenMealReporting.validator";
import { studentMealBookingRateLimiter } from "../middlewares/studentRateLimiter";
import { uploadFileWithMulter } from "../utils/configureMulterStorage";

const messMenuRouter = Router();


//Book Meal
messMenuRouter.get("/missed-booking", validateToken, fetchManuallyBookedMeals);
messMenuRouter.get("/book-meal/individual", validateToken, fetchIndividualBookMealDetails);
messMenuRouter.get("/details", validateToken, getBookedMealDetails);
messMenuRouter.get("/book-meal/:id", validateToken, getBookMealById);
messMenuRouter.post("/get-gatepass-info", validateToken, fetchGatepassInfoByMealId);

messMenuRouter.get("/:id", validateToken, getMenudetailsById);
messMenuRouter.delete("/delete", validateToken, deleteHosetelMessMenuById);
messMenuRouter.patch(
  "/update/:id",
  validateToken,
  updateHostelMessMenuDetailsById
);
messMenuRouter.post("/today-menu", validateToken, getTodayMenudetailsOfHostel);
messMenuRouter.post("/meal-booking", validateToken, bookMealByStudentOld);
messMenuRouter.post(
  "/cancel-booking",
  validateToken,
  cancelBookingMealByStudent
);
// messMenuRouter.post(
//   "/canceled-meal-history",
//   validateToken,
//   fetchCancelledMeals
// ); //TODO - fetch Cancelled Meals and booked status
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

// ---------------------------book meal by app(student) ---------------------------
messMenuRouter.post(
  "/v1/book-meals",
  validateToken,
  studentMealBookingRateLimiter,
  bookMealByStudent
);


messMenuRouter.post("/v1/monthly-meal", validateToken, getMonthlyMealData);

//--------------------------- (Warden Panel)------------------------------------------------

messMenuRouter.post(
  "/dashboard/meal-states",
  validateToken,
  validateZod(MealStateAnalyticsSchema),
  getMealStateAnalyticsByDate
);

messMenuRouter.post(
  "/warden/set/meal-timings",
  validateToken,
  validateZod(SetMealTimingSchema),
  setHostelMealTiming
);

messMenuRouter.post(
  "/warden/get/meal-timings",
  validateToken,
  validateZod(GetMealTimingSchema),
  getHostelMealTiming
);

messMenuRouter.post(
  "/warden/set/meal-cutoff",
  validateToken,
  validateZod(SetMealCutoffSchema),
  setHostelMealCutoff
);

messMenuRouter.post(
  "/warden/get/meal-cutoff",
  validateToken,
  validateZod(GetMealCutoffSchema),
  getHostelMealCutoff
);

//get meals analytics by date
messMenuRouter.post(
  "/menus",
  validateToken,
  getAllMessMenuWithPagination
);

// create mess menu for hostel per day
messMenuRouter.post(
  "/create",
  validateToken,
  validateZod(CreateMessMenuSchema),
  createMessMenuForHostel
);

//get all student meal status by date
messMenuRouter.post(
  "/warden/meals/students",
  validateToken,
  validateZod(WardenMealReportingSchema),
  getStudentsMealStatusByDate
);


export default messMenuRouter;
