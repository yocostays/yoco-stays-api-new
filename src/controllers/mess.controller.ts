import mongoose from "mongoose";
import { Request, Response } from "express";
import MessService from "../services/mess.service";
import StaffService from "../services/staff.service";
import UserService from "../services/user.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { excelToJson } from "../utils/excelToJson";
import { uploadFileToCloudStorage } from "../utils/awsUploadService";
import { MESS_BULK_UPLOAD_FILES } from "../utils/s3bucketFolder";
import {
  MealBookingStatusTypes,
  MealCountReportType,
  ReportDropDownTypes,
  SortingTypes,
} from "../utils/enum";

import { asyncHandler } from "../utils/asyncHandler";
import {
  BulkMealBookingSchema,
  CalendarMonthViewSchema,
  CreateMessMenuSchema,
  MealStateAnalyticsSchema,
  MessMenuPaginationSchema,
} from "../utils/validators/mealBooking.validator";
import { WardenMealReportingSchema } from "../utils/validators/wardenMealReporting.validator";
import {
  SetMealCutoffSchema,
  GetMealCutoffSchema,
} from "../utils/validators/mealCutoff.validator";
import {
  SetMealTimingSchema,
  GetMealTimingSchema,
} from "../utils/validators/mealTiming.validator";
import { studentMealBookingRateLimiter } from "../middlewares/studentRateLimiter";
import { sendSuccess, sendError, sendZodError } from "../utils/responseHelpers";
import { getValidatedStudent } from "../utils/entityHelpers";

const { getStaffById } = StaffService;
const { getStudentById } = UserService;

const {
  messMenuCreationForHostel,
  messMenuWithPagination,
  hostelMessManuById,
  deleteMenuById,
  updateHostelMessMenuById,
  todayHostelMenuByUserId,
  studentBookMeal,
  cancelBookingByStudent,
  // cancelledMealHistory,
  bulkUploadMessMenuForHostel,
  bookingReversible,
  studentEditBookedMeal,
  fetchMealDates,
  getBookedMealDetails,
  getBookMealById,
  fetchIndividualBookMealDetails,
  fetchGatepassInfoByMealId,
  manuallyBookMeal,
  fetchManuallyBookedMeals,
  studentBookMealBulk,
  getStudentMealBookingMonthlyView,
  setHostelMealTiming,
  getMealStateAnalyticsByDate,
  fetchStudentsMealStatusByDate,
  getHostelMealTiming,
  setHostelMealCutoff,
  getHostelMealCutoff,
} = MessService;
const {
  CREATE_DATA,
  FETCH_SUCCESS,
  UPDATE_DATA,
  DELETE_DATA,
  MEAL_CANCELLED,
  FILE_ON_PROCESS,
} = SUCCESS_MESSAGES;
const { INVALID_ID, REQUIRED_FIELD } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND, UNAUTHORIZED_ACCESS } = ERROR_MESSAGES;

class MessMenuController {
  //SECTION Controller method to handle mess menu creation for hostel
  createMessMenuForHostel = asyncHandler(
    async (req: Request, res: Response) => {
      const { fromDate, breakfast, lunch, snacks, dinner } = req.body;
      const createdById = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId || req.body.hostelId;

      // Identity validation (Defensive)
      if (!mongoose.isValidObjectId(createdById)) {
        return sendError(res, INVALID_ID);
      }

      const { staff } = await getStaffById(createdById);
      if (!staff) {
        return sendError(res, RECORD_NOT_FOUND("Staff"));
      }

      // Call Service
      const result = await messMenuCreationForHostel(
        hostelId,
        fromDate,
        breakfast,
        lunch,
        snacks,
        dinner,
        createdById
      );

      return sendSuccess(res, result);
    }
  );

  //SECTION Controller method to get mess menu with pagination and filters (POST)
  getAllMessMenuWithPagination = asyncHandler(
    async (req: Request, res: Response) => {
      const { hostelId, page, limit, sort, startDate, endDate } = req.body;

      //  Validate hostelId
      if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
        return sendError(res, REQUIRED_FIELD("Valid Hostel ID"));
      }

      //  Validate Dates (ISO format YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (startDate && !dateRegex.test(startDate)) {
        return sendError(res, "Start date must be in YYYY-MM-DD format");
      }
      if (endDate && !dateRegex.test(endDate)) {
        return sendError(res, "End date must be in YYYY-MM-DD format");
      }

      //  Pagination Safety
      const parsedPage = Math.max(1, parseInt(page as string) || 1);
      const parsedLimit = Math.min(
        50,
        Math.max(1, parseInt(limit as string) || 10)
      );

      const staffId = req.body._valid._id;
      const { staff } = await getStaffById(staffId);
      if (!staff) {
        return sendError(res, RECORD_NOT_FOUND("Staff"));
      }

      const { data, count } = await messMenuWithPagination(
        parsedPage,
        parsedLimit,
        hostelId as string,
        sort as SortingTypes,
        startDate as string,
        endDate as string
      );

      return sendSuccess(res, FETCH_SUCCESS, data, 200, count);
    }
  );

  //SECTION Controller method to get menu by id
  async getMenudetailsById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve menu by id
      const { messDetails } = await hostelMessManuById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: messDetails,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to delete mess menu by id
  async deleteHosetelMessMenuById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { messId } = req.body;

      for (const id of messId) {
        if (!mongoose.isValidObjectId(id)) throw new Error(INVALID_ID);
      }

      // Call the service to delete menu by id
      await deleteMenuById(messId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: DELETE_DATA,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to update mess menu by id
  async updateHostelMessMenuDetailsById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const updatedById = req.body._valid._id;
      const { id } = req.params;

      // Extract hostelId from token if available; otherwise, use the one from the body
      const tokenHostelId = req.body._valid?.hostelId || null;
      const hostelId = tokenHostelId || req.body.hostelId;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(updatedById);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { date, breakfast, lunch, snacks, dinner } = req.body;

      if (!hostelId || !date || !breakfast || !lunch || !snacks || !dinner) {
        const missingField = !hostelId
          ? "Hostel Id"
          : !date
            ? "Date"
            : !breakfast
              ? "Breakfast"
              : !lunch
                ? "Lunch"
                : !snacks
                  ? "Snacks"
                  : "Dinner";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to update hostel by id
      await updateHostelMessMenuById(
        id,
        hostelId,
        date,
        breakfast,
        lunch,
        snacks,
        dinner,
        staff._id
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: UPDATE_DATA,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to get menu by id
  async getTodayMenudetailsOfHostel(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;

      if (!mongoose.isValidObjectId(userId)) {
        throw new Error(INVALID_ID);
      }
      const { mealDate } = req.body;

      // Call the service to retrieve student
      const { student } = await getStudentById(userId);

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      // Call the service to retrieve menu by id
      const { messDetails } = await todayHostelMenuByUserId(
        student?.hostelId,
        mealDate
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: messDetails,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to book student meal
  async bookMealByStudentOld(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;

      const {
        fromDate,
        toDate,
        isBreakfastBooked,
        isLunchBooked,
        isSnacksBooked,
        isDinnerBooked,
        isfullDay,
      } = req.body;

      if (!mongoose.isValidObjectId(createdById)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve stduent deatails
      const { student } = await getStudentById(createdById);

      if (!student) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      if (!fromDate || !toDate) {
        const missingField = !fromDate ? "From Date" : "To Date";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new role
      await studentBookMeal(
        student?.hostelId,
        student?._id,
        fromDate,
        toDate,
        createdById,
        isfullDay,
        isBreakfastBooked,
        isLunchBooked,
        isDinnerBooked,
        isSnacksBooked
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: CREATE_DATA,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to cancel booked meal
  async cancelBookingMealByStudent(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;

      const {
        fromDate,
        toDate,
        isBreakfastBooked,
        isLunchBooked,
        isDinnerBooked,
        isSnacksBooked,
        isfullDay,
        cancellationReason,
      } = req.body;

      if (!mongoose.isValidObjectId(createdById)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve stduent deatails
      const { student } = await getStudentById(createdById);

      if (!student) {
        throw new Error(RECORD_NOT_FOUND("Student"));
      }

      if (!fromDate || !toDate) {
        const missingField = !fromDate ? "From Date" : "To Date";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new role
      await cancelBookingByStudent(
        student?.hostelId,
        student?._id,
        fromDate,
        toDate,
        createdById,
        cancellationReason,
        isfullDay,
        isBreakfastBooked,
        isLunchBooked,
        isDinnerBooked,
        isSnacksBooked
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: MEAL_CANCELLED,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to get cancel meal
  // async fetchCancelledMeals(
  //   req: Request,
  //   res: Response
  // ): Promise<Response<HttpResponse>> {
  //   try {
  //     const studentId = req.body._valid._id;

  //     if (!mongoose.isValidObjectId(studentId)) {
  //       throw new Error(INVALID_ID);
  //     }

  //     // Call the service to retrieve stduent deatails
  //     const { student } = await getStudentById(studentId);

  //     if (!student) {
  //       throw new Error(RECORD_NOT_FOUND("Student"));
  //     }

  //     const { status } = req.body;

  //     //Call the service to retrieve cancelled meal
  //     const { cancelMeal } = await cancelledMealHistory(
  //       student?.hostelId,
  //       student?._id,
  //       status
  //     );

  //     const successResponse: HttpResponse = {
  //       statusCode: 200,
  //       message: FETCH_SUCCESS,
  //       date: cancelMeal,
  //     };

  //     return res.status(200).json(successResponse);
  //   } catch (error: any) {
  //     const errorMessage = error.message ?? SERVER_ERROR;
  //     const errorResponse: HttpResponse = {
  //       statusCode: 400,
  //       message: errorMessage,
  //     };
  //     return res.status(400).json(errorResponse);
  //   }
  // }

  //SECTION Controller method to handle mess menu bulk upload
  async messMenuBulkUpload(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const createdById = req.body._valid._id;

      const file = req.file;

      if (!file) {
        throw new Error(REQUIRED_FIELD("File"));
      }

      // Respond immediately that the file is being processed
      res.status(200).send({
        statusCode: 200,
        message: FILE_ON_PROCESS,
      });

      const hostelId = req.body._valid.hostelId;

      const fileUrl = await uploadFileToCloudStorage(
        file,
        MESS_BULK_UPLOAD_FILES
      );
      const url = fileUrl && fileUrl.Key ? fileUrl?.Key : null;

      // Perform file processing after sending response
      const jsonData = await excelToJson(file.buffer);

      // Call the function to handle bulk upload of the data
      await bulkUploadMessMenuForHostel(
        jsonData,
        hostelId,
        createdById,
        url as string
      );

      // Do not send a response here as it was already sent earlier
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };

      // Return error response in case of failure
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to booking Reversible
  async bookingReversible(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const studentId = req.body._valid._id;
      const { mealId } = req.body;

      if (
        !mongoose.isValidObjectId(studentId) ||
        !mongoose.isValidObjectId(mealId)
      )
        throw new Error(INVALID_ID);

      // Call the service to retrieve stduent deatails
      const { student } = await getStudentById(studentId);

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      //Call the service to revers the booking
      await bookingReversible(mealId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: UPDATE_DATA,
      };

      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to edit booked or cancelled meal of student
  async editMealByStudent(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const studentId = req.body._valid._id;

      const {
        bookingId,
        isBreakfastBooked,
        isLunchBooked,
        isSnacksBooked,
        isDinnerBooked,
        isfullDay,
      } = req.body;

      if (!mongoose.isValidObjectId(studentId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve stduent deatails
      const { student } = await getStudentById(studentId);

      if (!student) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      if (!bookingId) {
        const missingField = "Booking Id";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to edit meal
      await studentEditBookedMeal(
        student?._id,
        bookingId,
        isfullDay,
        isBreakfastBooked,
        isLunchBooked,
        isDinnerBooked,
        isSnacksBooked
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: UPDATE_DATA,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to get meal dates based on status
  async getMealBookedDates(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const studentId = req.body._valid._id;

      if (!mongoose.isValidObjectId(studentId)) throw new Error(INVALID_ID);

      // Call the service to retrieve stduent deatails
      const { student } = await getStudentById(studentId);

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      const { date } = req.body;

      //Call the service to fetch Meal booking or cancelled Dates
      const { mealDates } = await fetchMealDates(date, studentId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        date: mealDates,
      };

      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to get book meal details according to meal status
  async getBookedMealDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      const {
        page,
        limit,
        status,
        mealType,
        search,
        sort,
        floorNumber,
        roomNumber,
        startDate,
        endDate,
      } = req.query;

      // Validate the createdById
      if (!mongoose.isValidObjectId(createdById)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      const { mealDetails, count } = await getBookedMealDetails(
        parsedPage,
        parsedLimit,
        status as MealBookingStatusTypes,
        mealType as MealCountReportType,
        search as string,
        sort as SortingTypes,
        hostelId,
        floorNumber as string,
        roomNumber as string,
        startDate as string,
        endDate as string
      );
      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: mealDetails,
      };

      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to get book meal by Id
  async getBookMealById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;
      const { id } = req.params;

      // Validate the createdById
      if (
        !mongoose.isValidObjectId(createdById) ||
        !mongoose.isValidObjectId(id)
      )
        throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { data } = await getBookMealById(id);
      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to get book meal history of each student
  async fetchIndividualBookMealDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const { page, limit, studentId, durationType, startDate, endDate } =
        req.query;
      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve Student
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      const { data, count } = await fetchIndividualBookMealDetails(
        studentId as string,
        parsedPage,
        parsedLimit,
        durationType as ReportDropDownTypes,
        startDate as string,
        endDate as string
      );
      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to get book meal detail by Id
  async fetchGatepassInfoByMealId(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const { bookMealId } = req.body;
      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      // Call the service to retrieve Student
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));
      const { data } = await fetchGatepassInfoByMealId(bookMealId);
      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to book meal manually
  async manuallyBookMeal(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid.hostelId;

      const { date, studentId, mealType } = req.body;

      if (
        !mongoose.isValidObjectId(staffId) ||
        !mongoose.isValidObjectId(studentId)
      ) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve Student
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      if (!date || !studentId || !mealType) {
        const missingField = !date
          ? "Date"
          : !studentId
            ? "Student"
            : "Meal Type";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to manually Book Meal
      await manuallyBookMeal(hostelId, studentId, date, mealType, staffId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: CREATE_DATA,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to get all missed booking user details
  async fetchManuallyBookedMeals(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid.hostelId;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve Student
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const {
        page,
        limit,
        mealStatus,
        sort,
        startDate,
        endDate,
        floorNumber,
        roomNumber,
      } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to fetch Manually Booked Meals
      const { count, users } = await fetchManuallyBookedMeals(
        parsedPage,
        parsedLimit,
        mealStatus as MealCountReportType,
        sort as SortingTypes,
        hostelId as string,
        startDate as string,
        endDate as string,
        floorNumber as string,
        roomNumber as string
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: users,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to book meals
  bookMealByStudent = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.body._valid._id;

    // Validate request body with Zod
    const parseResult = BulkMealBookingSchema.safeParse(req.body);

    const validationError = sendZodError(res, parseResult);
    if (validationError) return validationError;

    const { bookings } = parseResult.data!; // Safe after validation check
    const student = await getValidatedStudent(studentId);

    // Call the new service method
    await studentBookMealBulk(student.hostelId, student._id, bookings);

    return sendSuccess(res, CREATE_DATA);
  });

  //SECTION Controller method to get monthly meal booking data (V1 - readonly)
  getMonthlyMealData = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.body._valid._id;

    // Validate request body with Zod
    const parseResult = CalendarMonthViewSchema.safeParse(req.body);

    const validationError = sendZodError(res, parseResult);
    if (validationError) return validationError;

    const { date, year, month } = parseResult.data!; // Safe after validation check
    const student = await getValidatedStudent(studentId);

    // Call the service method
    const { results, mealTimings } = await getStudentMealBookingMonthlyView(
      student.hostelId,
      student._id,
      date,
      year,
      month
    );

    return sendSuccess(res, FETCH_SUCCESS, {
      results,
      mealTimings,
    });
  });

  // // ----------------------------warden APIs-----------------------------------

  //SECTION Controller method to get meal state analytics by date
  getMealStateAnalyticsByDate = asyncHandler(
    async (req: Request, res: Response) => {
      const parseResult = MealStateAnalyticsSchema.safeParse(req.body);
      const validationError = sendZodError(res, parseResult);
      if (validationError) return validationError;

      const { hostelId, date } = parseResult.data!;

      const result = await getMealStateAnalyticsByDate(hostelId, date);

      return sendSuccess(res, FETCH_SUCCESS, result);
    }
  );

  // // SECTION: Controller method to set hostel meal timings
  setHostelMealTiming = asyncHandler(async (req: Request, res: Response) => {
    const requesterId = (req as any).user.id;

    // Fetch requester details for authorization
    const { staff } = await getStaffById(requesterId);
    if (!staff) {
      return sendError(res, UNAUTHORIZED_ACCESS, 401);
    }

    // Role Authorization
    const roleName = staff.roleId?.name?.toLowerCase() || "";
    const isAdmin = roleName === "admin";
    const isWarden = roleName === "warden";

    if (!isAdmin && !isWarden) {
      return sendError(res, "Access forbidden: Requester is not a Warden or Admin", 403);
    }

    // Input Validation
    const parseResult = SetMealTimingSchema.safeParse(req.body);
    const validationError = sendZodError(res, parseResult);
    if (validationError) return validationError;

    const dto = parseResult.data!;

    // Warden data scoping: Wardens can only set timings for their assigned hostels.
    if (isWarden) {
      const isAssigned = staff.hostelIds?.some(
        (id: any) => id._id.toString() === dto.hostelId
      );
      if (!isAssigned) {
        return sendError(res, "Access forbidden: Warden not assigned to this hostel", 403);
      }
    }

    await setHostelMealTiming(dto, requesterId);

    return sendSuccess(res, UPDATE_DATA);
  });

  //SECTION Controller method to get hostel meal timings
  getHostelMealTiming = asyncHandler(async (req: Request, res: Response) => {
    const requesterId = (req as any).user.id;

    const { staff } = await getStaffById(requesterId);
    if (!staff) {
      return sendError(res, UNAUTHORIZED_ACCESS, 401);
    }

    const roleName = staff.roleId?.name?.toLowerCase() || "";
    const isAdmin = roleName === "admin";
    const isWarden = roleName === "warden";

    if (!isAdmin && !isWarden) {
      return sendError(res, "Access forbidden: Requester is not a Warden or Admin", 403);
    }

    const parseResult = GetMealTimingSchema.safeParse(req.body);
    const validationError = sendZodError(res, parseResult);
    if (validationError) return validationError;

    const { hostelId } = parseResult.data!;

    if (isWarden) {
      const isAssigned = staff.hostelIds?.some(
        (id: any) => id._id.toString() === hostelId
      );
      if (!isAssigned) {
        return sendError(res, "Access forbidden: Warden not assigned to this hostel", 403);
      }
    }

    const result = await getHostelMealTiming(hostelId);

    return sendSuccess(res, FETCH_SUCCESS, result);
  });

  //SECTION Controller method to set hostel meal cutoffs
  setHostelMealCutoff = asyncHandler(async (req: Request, res: Response) => {
    const requesterId = (req as any).user.id;

    const { staff } = await getStaffById(requesterId);
    if (!staff) {
      return sendError(res, UNAUTHORIZED_ACCESS, 401);
    }

    const roleName = staff.roleId?.name?.toLowerCase() || "";
    const isAdmin = roleName === "admin";
    const isWarden = roleName === "warden";

    if (!isAdmin && !isWarden) {
      return sendError(res, "Access forbidden: Requester is not a Warden or Admin", 403);
    }

    const parseResult = SetMealCutoffSchema.safeParse(req.body);
    const validationError = sendZodError(res, parseResult);
    if (validationError) return validationError;

    const dto = parseResult.data!;

    if (isWarden) {
      const isAssigned = staff.hostelIds?.some(
        (id: any) => id._id.toString() === dto.hostelId
      );
      if (!isAssigned) {
        return sendError(res, "Access forbidden: Warden not assigned to this hostel", 403);
      }
    }

    await setHostelMealCutoff(dto, requesterId);

    return sendSuccess(res, UPDATE_DATA);
  });



  //SECTION Controller method to get hostel meal cutoffs
  getHostelMealCutoff = asyncHandler(async (req: Request, res: Response) => {
    const requesterId = (req as any).user.id;

    // Fetch requester details for authorization
    const { staff } = await getStaffById(requesterId);
    if (!staff) {
      return sendError(res, UNAUTHORIZED_ACCESS, 401);
    }

    // Role Authorization
    const roleName = staff.roleId?.name?.toLowerCase() || "";
    const isAdmin = roleName === "admin";
    const isWarden = roleName === "warden";

    if (!isAdmin && !isWarden) {
      return sendError(res, "Access forbidden: Requester is not a Warden or Admin", 403);
    }

    // Input Validation
    const parseResult = GetMealCutoffSchema.safeParse(req.body);
    const validationError = sendZodError(res, parseResult);
    if (validationError) return validationError;

    const { hostelId } = parseResult.data!;

    // Warden data scoping
    if (isWarden) {
      const isAssigned = staff.hostelIds?.some(
        (id: any) => id._id.toString() === hostelId
      );
      if (!isAssigned) {
        return sendError(res, "Access forbidden: Warden not assigned to this hostel", 403);
      }
    }

    const result = await getHostelMealCutoff(hostelId);

    return sendSuccess(res, FETCH_SUCCESS, result);
  });



  // SECTION: Controller method to get students meal status by date (Warden)
  getStudentsMealStatusByDate = asyncHandler(
    async (req: Request, res: Response) => {
      const requesterId = (req as any).user.id;

      // Fetch requester details for authorization
      const { staff } = await getStaffById(requesterId);
      if (!staff) {
        return sendError(res, UNAUTHORIZED_ACCESS, 401);
      }

      // Role Authorization (Must be warden or admin)
      const roleName = staff.roleId?.name?.toLowerCase() || "";
      const isAdmin = roleName === "admin";
      const isWarden = roleName === "warden";

      if (!isAdmin && !isWarden) {
        return sendError(
          res,
          "Access forbidden: Requester is not a Warden or Admin",
          403
        );
      }

      // Input Validation
      const parseResult = WardenMealReportingSchema.safeParse(req.body);
      const validationError = sendZodError(res, parseResult);
      if (validationError) return validationError;

      const dto = parseResult.data!;

      // Wardens must be assigned to the requested hostelId.
      // Admins are assumed to have access to all hostels unless specified otherwise in business rules.
      if (isWarden) {
        const isAssigned = staff.hostelIds?.some(
          (id: any) => id._id.toString() === dto.hostelId
        );

        if (!isAssigned) {
          return sendError(
            res,
            "Access forbidden: Warden not assigned to this hostel",
            403
          );
        }
      }

      // Call Service with DTO
      const result = await fetchStudentsMealStatusByDate(dto);

      return sendSuccess(res, FETCH_SUCCESS, result);
    }
  );

  // SECTION: Controller method to get monthly meal data for a specific student (Warden)
  getStudentMonthlyMealDataForWarden = asyncHandler(
    async (req: Request, res: Response) => {
      const requesterId = (req as any).user.id;
      const { WardenStudentMonthlyViewSchema } = await import(
        "../utils/validators/wardenMealReporting.validator"
      );

      // Fetch requester details for authorization
      const { staff } = await getStaffById(requesterId);
      if (!staff) {
        return sendError(res, UNAUTHORIZED_ACCESS, 401);
      }

      // Role Authorization
      const roleName = staff.roleId?.name?.toLowerCase() || "";
      const isAdmin = roleName === "admin";
      const isWarden = roleName === "warden";

      if (!isAdmin && !isWarden) {
        return sendError(
          res,
          "Access forbidden: Requester is not a Warden or Admin",
          403
        );
      }

      // Input Validation
      const parseResult = WardenStudentMonthlyViewSchema.safeParse(req.body);
      const validationError = sendZodError(res, parseResult);
      if (validationError) return validationError;

      const { studentId, year, month, filters } = parseResult.data!;

      // Fetch Student to get Hostel ID
      const { student } = await getStudentById(studentId);
      if (!student) {
        return sendError(res, RECORD_NOT_FOUND("Student"));
      }

      // Warden Scoping: Check if student belongs to a hostel assigned to the Warden
      if (isWarden) {
        const isAssigned = staff.hostelIds?.some(
          (id: any) => id._id.toString() === student.hostelId?._id?.toString()
        );

        if (!isAssigned) {
          return sendError(
            res,
            "Access forbidden: Student belongs to a hostel not assigned to this Warden",
            403
          );
        }
      }

      // Call the service method
      const { results } = await getStudentMealBookingMonthlyView(
        student.hostelId?._id?.toString() || student.hostelId?.toString(),
        student._id,
        undefined, // Date undefined as we drive by Month/Year
        year,
        month
      );

      // Status Transformation for Warden View (Derived Status Only)
      let transformedResults = results.map((dayParams: any) => {
        const dateObj = new Date(dayParams.date);

        // Helper to determine status
        const getStatus = (mealData: any) => {
          // 1. No Data / No Menu
          if (!mealData) return "NOT_BOOKED";
          const { state, consumed } = mealData;

          if (state === "NOT_APPLICABLE") return "NOT_BOOKED";

          // 2. Confirmed Cases
          if (state === "CONFIRMED") {
            if (consumed) return "CONSUMED";

            // Check for "MISSED": Confirmed + Not Consumed + Past date
            // We compare the booking date with "today" (start of day).
            // If booking date < today, it is strictly in the past => MISSED.
            const bookingDate = new Date(dayParams.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (bookingDate < today) return "MISSED";

            return "CONFIRMED"; // Future/Today pending consumption
          }

          // 3. Skipped Cases
          if (state === "SKIPPED") {
            if (consumed) return "SKIPPED_CONSUMED";
            return "SKIPPED";
          }

          // 4. Pending / Other
          return state || "NOT_BOOKED";
        };

        return {
          date: dayParams.date,
          meals: {
            breakfast: { status: getStatus(dayParams.meals.breakfast) },
            lunch: { status: getStatus(dayParams.meals.lunch) },
            snacks: { status: getStatus(dayParams.meals.snacks) },
            dinner: { status: getStatus(dayParams.meals.dinner) },
          }
        };
      });

      // Apply Filters if provided
      if (filters?.mealStatus && filters.mealStatus.length > 0) {
        const validStatuses = new Set(filters.mealStatus);

        transformedResults = transformedResults.map((day) => {
          let hasMatch = false;

          for (const [meal, data] of Object.entries(day.meals)) {
            if (validStatuses.has((data as any).status)) {
              hasMatch = true;
              break; // Found one match, keep the whole day
            }
          }

          if (hasMatch) {
            return day; // Return the full day object with all meals
          }
          return null; // Drop day if no meals match
        }).filter((day) => day !== null);
      }

      return sendSuccess(res, FETCH_SUCCESS, {
        results: transformedResults,
        student: {
          _id: student._id,
          name: student.name,
          uniqueId: student.uniqueId,
          hostelId: student.hostelId
        }
      });
    }
  );
}

export default new MessMenuController();
