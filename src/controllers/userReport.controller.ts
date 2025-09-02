import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import { Request, Response } from "express";
import UserReportService from "../services/userReport.service";
import UserService from "../services/user.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { generateCsvString } from "../utils/generateCsvString";

const { userCountReport, totalStudentAndStaffCount, exportStudentDetails } =
  UserReportService;
const { studentDetailsByType } = UserService;

const { getStaffById } = StaffService;

const { FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class UserReportController {
  //SECTION Controller method to handle get user count report
  async getUserCountReport(
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

      // Call the service to get user report
      const { report } = await userCountReport(hostelId);

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

  //SECTION Controller method to handle total staff and user count report per hostel(Graph)
  async totalStudentAndStaffCount(
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

      const { dateRange } = req.body;

      // Call the service to get user report
      const { report } = await totalStudentAndStaffCount(hostelId, dateRange);

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
  async graphReportExport(
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
      const { dateRange } = req.body;

      // Call the service to get user report
      const { report } = await totalStudentAndStaffCount(hostelId, dateRange);

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

  //SECTION Controller method to export student details for admin and warden panel (PDF)
  async exportStudentDetailsByIdAndType(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      const { studentId, type } = req.body;

      // Call the service to retrieve student
      const { details } = await studentDetailsByType(studentId, type);

      // Remove the _id field if it exists in the details
      if ("_id" in details) {
        delete details._id;
      }

      // Create a PDF document
      const doc = new PDFDocument();

      // Set response headers for PDF download
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="student-details.pdf"'
      );
      res.setHeader("Content-Type", "application/pdf");

      // Pipe the PDF document to the response
      doc.pipe(res);

      // Add content to the PDF (you can customize this based on your details structure)
      doc.fontSize(18).text(`Student Details`, { align: "center" });
      doc.moveDown();

      // Iterate over details and add to the PDF
      for (const [key, value] of Object.entries(details)) {
        doc.fontSize(12).text(`${key}: ${value}`, { align: "left" });
        doc.moveDown();
      }

      // Finalize the PDF document
      doc.end();
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to export all stdent details
  async exportStudentDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const { studentIds, type } = req.body;

      // Call the service to retrieve student details based on hostelId, studentIds, and type
      const { result } = await exportStudentDetails(
        hostelId,
        type,
        studentIds
      );

      if (!result || result.length === 0) {
        throw new Error(RECORD_NOT_FOUND("Students"));
      }
      // Dynamically create headers based on the first result's data (assuming all students have similar structure)
      const headers = Object.keys(result[0]).map((key) => ({
        id: key,
        title: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize the first letter of each key
      }));

      // Generate CSV string using dynamic function
      const csv = generateCsvString(result, headers);

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
}

export default new UserReportController();
