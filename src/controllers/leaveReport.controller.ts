import mongoose from "mongoose";
import { Request, Response } from "express";
import LeaveReportService from "../services/leaveReport.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { generateCsvString } from "../utils/generateCsvString";
import { ReportDropDownTypes } from "../utils/enum";

const { leaveReportSummary, leaveGraphCountSummary, exportLeaveDetails } =
  LeaveReportService;
const { getStaffById } = StaffService;

const { FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class LeaveReportController {
  //SECTION Controller method to handle get leave report count
  async leaveReportCountSummary(
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

      const { durationType, startDate, endDate } = req.body;

      // Call the service to get user report
      const { report } = await leaveReportSummary(
        hostelId,
        durationType ?? ReportDropDownTypes.TODAY,
        startDate,
        endDate
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

  //SECTION Controller method to handle get graph report
  async leaveGraphCountSummary(
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

      const { durationType } = req.body;

      // Call the service to get user report
      const { report } = await leaveGraphCountSummary(hostelId, durationType);

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

  //SECTION Controller method to handle graph Report Export
  async leaveGraphReportExport(
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

      const { durationType } = req.body;

      // Call the service to get user report
      const { report } = await leaveGraphCountSummary(hostelId, durationType);

      // Define headers for CSV export dynamically
      const headers = [
        { id: "label", title: "Category" },
        { id: "value", title: "Value" },
      ];

      // Generate CSV string using dynamic function
      const csv = generateCsvString(report, headers);

      // Set response headers for CSV download
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=leaveReport.csv"
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

  //SECTION Controller method to export details
  async exportLeaveDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const {
        leaveIds,
        type,
        leaveStatus,
        leaveType,
        floorNumber,
        roomNumber,
        search
      } = req.body;

      // Call the service to retrieve student details based on hostelId, studentIds, and type
      const { result } = await exportLeaveDetails(
        hostelId,
        leaveStatus,
        leaveType,
        type,
        leaveIds,
        floorNumber,
        roomNumber,
        search
      );

      if (!result || result.length === 0) {
        throw new Error(RECORD_NOT_FOUND("Leave"));
      }
      // Dynamically create headers based on the first leave data
      const headers = Object.keys(result[0]).map((key) => ({
        id: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
      }));

      // Generate CSV string using dynamic function
      const csv = generateCsvString(result, headers);

      // Set response headers for CSV download
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=leaveReport.csv"
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

export default new LeaveReportController();
