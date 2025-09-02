import mongoose from "mongoose";
import { Request, Response } from "express";
import MessReportService from "../services/messReport.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import {
  MealBookingStatusTypes,
  MealConsumedType,
  MealCountReportType,
  ReportDropDownTypes,
  SortingTypes,
} from "../utils/enum";
import { generateCsvString } from "../utils/generateCsvString";

const {
  messDetailsCountReport,
  mealConsumptionList,
  mealConsumptionListExport,
  exportBooKMealDetails,
  exportMessMenuDetails,
  exportMissedBookingDetails
} = MessReportService;

const { getStaffById } = StaffService;

const { FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class MessReportController {
  //SECTION Controller method to handle get apply student for mess (lunch, dinner or breakfast)
  async messCountReport(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { status, type } = req.body;

      // Call the service to get user report
      const { report } = await messDetailsCountReport(
        hostelId,
        status ?? ReportDropDownTypes.TODAY,
        type ?? MealBookingStatusTypes.BOOKED
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: report,
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

  //SECTION Controller method to handle get mess student list (consumption/defaulter)
  async consumedMealsList(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { consumedType, durationType } = req.body;

      // Call the service to get user report
      const { report } = await mealConsumptionList(
        hostelId,
        consumedType ?? MealConsumedType.CONSUMPTION,
        durationType ?? ReportDropDownTypes.TODAY
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: report,
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

  //SECTION Controller method to handle get mess student list (consumption/defaulter) export
  async consumedMealsListExport(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { consumedType, durationType } = req.body;

      // Call the service to get user report
      const { report, headers } = await mealConsumptionListExport(
        hostelId,
        consumedType ?? MealConsumedType.CONSUMPTION,
        durationType ?? ReportDropDownTypes.TODAY
      );

      // Generate CSV string using dynamic function
      const csv = generateCsvString(report, headers);
      // Set response headers for CSV download
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=studentReport.csv"
      );
      res.setHeader("Content-Type", "text/csv");

      // Send the CSV content
      res.status(200).send(csv);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to export book meal details excel
  async exportBooKMealDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const {
        bookMealIds,
        type,
        status,
        mealType,
        search,
        sort,
        floorNumber,
        roomNumber,
        startDate,
        endDate,
      } = req.body;

      // Call the service to retrieve student details based on hostelId, studentIds, and type
      const { result } = await exportBooKMealDetails(
        status,
        mealType,
        type,
        search,
        sort,
        hostelId,
        floorNumber,
        roomNumber,
        startDate,
        endDate,
        bookMealIds,
      );

      if (!result || result.length === 0) {
        throw new Error(RECORD_NOT_FOUND("BookMeal"));
      }
      // Dynamically create headers based on the first BookMeal data
      const headers = Object.keys(result[0]).map((key) => ({
        id: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
      }));

      // Generate CSV string using dynamic function
      const csv = generateCsvString(result, headers);

      // Set response headers for CSV download
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=bookMealReport.csv"
      );
      res.setHeader("Content-Type", "text/csv");

      // Send the CSV content
      res.status(200).send(csv);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to export mess menu deafault excel
  async exportMessMenuDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const { bookMealIds, type, sort, mealType, startDate, endDate } = req.body;

      // Call the service to retrieve student details based on hostelId, studentIds, and type
      const { result } = await exportMessMenuDetails(
        hostelId,
        type,
        mealType as MealCountReportType,
        sort as SortingTypes,
        startDate as string,
        endDate as string,
        bookMealIds,

      );

      if (!result || result.length === 0) {
        throw new Error(RECORD_NOT_FOUND("BookMeal"));
      }
      // Dynamically create headers based on the first BookMeal data
      const headers = Object.keys(result[0]).map((key) => ({
        id: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
      }));

      // Generate CSV string using dynamic function
      const csv = generateCsvString(result, headers);

      // Set response headers for CSV download
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=messMenulReport.csv"
      );
      res.setHeader("Content-Type", "text/csv");

      // Send the CSV content
      res.status(200).send(csv);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to export missed booking details
  async exportMissedBookingDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const {
        missedBookingIds,
        type,
        mealReportType,
        sort,
        startDate,
        endDate,
        floorNumber,
        roomNumber
      } = req.body;

      // Call the service to retrieve missed booking details
      const { result } = await exportMissedBookingDetails(
        type,
        mealReportType,
        missedBookingIds,
        sort,
        hostelId,
        startDate,
        endDate,
        floorNumber,
        roomNumber
      );

      if (!result || result.length === 0) {
        throw new Error(RECORD_NOT_FOUND("BookMeal"));
      }

      // Dynamically create headers based on the first result's keys
      const headers = Object.keys(result[0]).map((key) => ({
        id: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
      }));

      // Generate CSV string using dynamic headers and result data
      const csv = generateCsvString(result, headers);

      // Set response headers for CSV download
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=missedBookingReport.csv"
      );
      res.setHeader("Content-Type", "text/csv");

      // Send the CSV content
      res.status(200).send(csv);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

}

export default new MessReportController();
