import mongoose from "mongoose";
import { Request, Response } from "express";
import FoodWastageReportService from "../services/foodWastageReport.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { ReportDropDownTypes } from "../utils/enum";
import { generateCsvString } from "../utils/generateCsvString";

const { foodWastageReport, exportFoodWastageDetails } =
  FoodWastageReportService;

const { getStaffById } = StaffService;

const { FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class FoodWastageReportController {
  //SECTION Controller method to get FoodWastage report
  async foodWastageReport(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;
      if (
        !mongoose.isValidObjectId(createdById) ||
        !mongoose.isValidObjectId(hostelId)
      ) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }
      const { durationType } = req.body;
      const { data, total } = await foodWastageReport(
        hostelId,
        durationType as ReportDropDownTypes
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        total,
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

  //SECTION Controller method to export foodWastage detail in excel
  async exportFoodWastageDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const { foodWastageIds, type } = req.body;

      // Call the service to retrieve student details based on hostelId, studentIds, and type
      const { result } = await exportFoodWastageDetails(
        hostelId,
        type,
        foodWastageIds
      );

      if (!result || result.length === 0)
        throw new Error(RECORD_NOT_FOUND("FoodWastage"));

      // Dynamically create headers based on the first foodwastage data
      const headers = Object.keys(result[0]).map((key) => ({
        id: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
      }));

      // Generate CSV string using dynamic function
      const csv = generateCsvString(result, headers);

      // Set response headers for CSV download
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=foodWastageReport.csv"
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

export default new FoodWastageReportController();
