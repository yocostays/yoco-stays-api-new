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

// DRY Helper imports (only for newly created APIs)
import { asyncHandler } from "../utils/asyncHandler";
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
  getMealStateAnalyticsByDate
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
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class MessMenuController {
  //SECTION Controller method to handle mess menu creation for hostel
  async createMessMenuForHostel(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;

      // Extract hostelId from token if available; otherwise, use the one from the body
      const tokenHostelId = req.body._valid?.hostelId;

      const hostelId = tokenHostelId || req.body.hostelId;

      const { fromDate, toDate, breakfast, lunch, snacks, dinner } = req.body;

      // Validate the createdById
      if (!mongoose.isValidObjectId(createdById)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Validate required fields
      if (
        !hostelId ||
        !fromDate ||
        !toDate ||
        !breakfast ||
        !lunch ||
        !snacks ||
        !dinner
      ) {
        const missingField = !hostelId
          ? "Hostel Id"
          : !fromDate
            ? "From Date"
            : !toDate
              ? "To Date"
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

      // Call the service to create a new menu
      await messMenuCreationForHostel(
        hostelId,
        fromDate,
        toDate,
        breakfast,
        lunch,
        snacks,
        dinner,
        createdById
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

  //SECTION Controller method to get mess menu with optional pagination and search
  async getAllMessMenuWithPagination(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const hostelId = req.body._valid.hostelId;

      const { page, limit, mealType, sort, startDate, endDate } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to retrieve all hostel
      const { data, count } = await messMenuWithPagination(
        parsedPage,
        parsedLimit,
        hostelId as string,
        mealType as MealCountReportType,
        sort as SortingTypes,
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
    const { BulkMealBookingSchema } = await import(
      "../utils/validators/mealBooking.validator"
    );

    const parseResult = BulkMealBookingSchema.safeParse(req.body);

    const validationError = sendZodError(res, parseResult);
    if (validationError) return validationError;

    const { bookings } = parseResult.data!; // Safe after validation check
    const student = await getValidatedStudent(studentId);

    // Call the new service method
    await studentBookMealBulk(
      student.hostelId,
      student._id,
      bookings
    );

    return sendSuccess(res, CREATE_DATA);
  });

  //SECTION Controller method to get monthly meal booking data (V1 - readonly)
  getMonthlyMealData = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.body._valid._id;

    // Validate request body with Zod
    const { CalendarMonthViewSchema } = await import(
      "../utils/validators/mealBooking.validator"
    );
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

  //SECTION Controller method to get student meal status by date

  getMealStateAnalyticsByDate = asyncHandler(
    async (req: Request, res: Response) => {
      const { hostelId, date } = req.body;

      const result = await getMealStateAnalyticsByDate(
        hostelId,
        date
      );

      return sendSuccess(res, FETCH_SUCCESS, result);
    }
  );

  // // SECTION: Controller method to set hostel meal timings
  setHostelMealTiming = asyncHandler(async (req: Request, res: Response) => {
     await setHostelMealTiming(req.body);

    return sendSuccess(res, UPDATE_DATA);
  });
}

export default new MessMenuController();
