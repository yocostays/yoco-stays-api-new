import mongoose from "mongoose";
import { Request, Response } from "express";
import BulkUploadService from "../services/bulkUpload.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { BulkUploadTypes } from "../utils/enum";

const { allBulkUploadedFiles } = BulkUploadService;

const { getStaffById } = StaffService;

const { FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class BulkUploadController {
  //SECTION Controller method to handle get all bulk upload files
  async getAllBulkUploadFiles(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { page, limit, fileType } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to get bulkData
      const { count, bulkData } = await allBulkUploadedFiles(
        staffId,
        staff.roleId,
        parsedPage,
        parsedLimit,
        fileType as BulkUploadTypes
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: bulkData,
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
}

export default new BulkUploadController();
