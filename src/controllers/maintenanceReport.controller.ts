import mongoose from "mongoose";
import { Request, Response } from "express";
import MaintenanceReportService from "../services/maintenanceReport.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import {
  ComplainStatusTypes,
  ExportTypes,
  ReportDropDownTypes,
  SortingTypes,
} from "../utils/enum";
import { generateCsvString } from "../utils/generateCsvString";

const {
  topMaintenanceCategoryList,
  maintenanceSummary,
  totalComplaintCounts,
  complaintResolutionMetrics,
  exportComplaintDetails,
} = MaintenanceReportService;
const { getStaffById } = StaffService;

const { FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class MaintenanceReportController {
  //SECTION Controller method to handle get top maintenance compaint category
  async topMaintenanceCategoryList(
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

      const { filter, startDate, endDate } = req.body;

      // Call the service to get user report
      const { report } = await topMaintenanceCategoryList(
        hostelId,
        filter,
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

  //SECTION Controller method to handle maintenance Summary Report for warden panel
  async maintenanceSummaryReport(
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

      // Call the service to get maintenance Summary
      const { report } = await maintenanceSummary(hostelId);

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

  //SECTION Controller method to handle get total maintenance compaint counts
  async totalComplaintCounts(
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
      const { filter, startDate, endDate } = req.body;

      // Call the service to get total Complaint Counts
      const { counts } = await totalComplaintCounts(
        hostelId,
        filter as ReportDropDownTypes,
        startDate,
        endDate
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: counts,
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

  async complaintResolutionMetrics(
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
      const { filter, startDate, endDate } = req.body;

      // Call the service to get complaint Resolution Metrics
      const { report } = await complaintResolutionMetrics(
        hostelId,
        filter as ReportDropDownTypes,
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

  //SECTION Controller method to export complaint deafault excel
  async exportComplaintDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const {
        type,
        compaintIds,
        status,
        categoryId,
        sort,
        startDate,
        endDate,
        search,
        floorNumber,
        roomNumber,
      } = req.body;

      // Call the service to Complaint Details
      const { complaint } = await exportComplaintDetails(
        type as ExportTypes,
        staffId,
        status as ComplainStatusTypes,
        staff.roleId?.name,
        hostelId,
        categoryId as string,
        sort as SortingTypes,
        startDate as string,
        endDate as string,
        search as string,
        floorNumber as string,
        roomNumber as string,
        compaintIds
      );

      if (!complaint || complaint.length === 0) {
        throw new Error(RECORD_NOT_FOUND("Complaint"));
      }
      // Dynamically create headers based on the first Complaint data
      const headers = Object.keys(complaint[0]).map((key) => ({
        id: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
      }));

      // Generate CSV string using dynamic function
      const csv = generateCsvString(complaint, headers);

      // Set response headers for CSV download
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=complaint.csv"
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

export default new MaintenanceReportController();
