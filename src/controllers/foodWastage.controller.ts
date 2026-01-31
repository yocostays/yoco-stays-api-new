import mongoose from "mongoose";
import { Request, Response } from "express";
import FoodWastageService from "../services/foodWastage.service";
import MessService from "../services/mess.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { MealCountReportType, SortingTypes, UnitTypes } from "../utils/enum";
import { excelToJson } from "../utils/excelToJson";
import { uploadFileToCloudStorage } from "../utils/awsUploadService";
import { FOOD_WASTAGE_BULK_UPLOAD_FILES } from "../utils/s3bucketFolder";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendError, sendZodError } from "../utils/responseHelpers";
import { CreateFoodWastageSchema, FoodWastagePaginationSchema } from "../utils/validators/foodWastage.validator";

const {
  createFoodWastage,
  getFoodWastageById,
  updateFoodWastage,
  deleteFoodWastageById,
  bulkUploadFoodWastageForHostel,
  getDateWiseWastageCount,
} = FoodWastageService;

const { getStaffById } = StaffService;

const {
  CREATE_DATA,
  FETCH_SUCCESS,
  UPDATE_DATA,
  DELETE_DATA,
  FILE_ON_PROCESS,
} = SUCCESS_MESSAGES;
const { INVALID_ID, REQUIRED_FIELD } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class FoodWastageController {
  //SECTION: Controller to create FoodWastage
  createFoodWastage = asyncHandler(
    async (req: Request, res: Response): Promise<Response<HttpResponse>> => {
      // Validate input using Zod
      const parseResult = CreateFoodWastageSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      const { hostelId, date, breakfast, lunch, snacks, dinner } =
        parseResult.data;
      const createdById = req.body._valid._id;

      if (!mongoose.isValidObjectId(createdById)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      await createFoodWastage(
        date,
        breakfast,
        lunch,
        snacks,
        dinner,
        hostelId,
        createdById
      );

      return sendSuccess(res, CREATE_DATA);
    }
  );

  //SECTION Controller to get all FoodWastage (POST)
  getAllFoodWastage = asyncHandler(
    async (req: Request, res: Response): Promise<Response<HttpResponse>> => {
      // Validate input using Zod
      const parseResult = FoodWastagePaginationSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      const { hostelId, page, limit, sort, startDate, endDate } = parseResult.data;
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      //we are reusing messMenuWithPagination service to get food wastage with pagination
      const { data, count } = await MessService.messMenuWithPagination(
        page,
        limit,
        hostelId,
        sort as any,
        startDate,
        endDate,
        true
      );

      return sendSuccess(res, FETCH_SUCCESS, data, 200, count);
    }
  );

  //SECTION Controller method to get FoodWastage by id
  getFoodWastageById = asyncHandler(
    async (req: Request, res: Response): Promise<Response<HttpResponse>> => {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) throw new Error(INVALID_ID);

      const { data } = await getFoodWastageById(id);
      return sendSuccess(res, FETCH_SUCCESS, data);
    }
  );

  //SECTION Controller to update FoodWastage
  updateFoodWastage = asyncHandler(
    async (req: Request, res: Response): Promise<Response<HttpResponse>> => {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) throw new Error(INVALID_ID);

      // Validate input using Zod
      const parseResult = CreateFoodWastageSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      const { hostelId, date, breakfast, lunch, snacks, dinner } =
        parseResult.data;
      const updatedById = req.body._valid._id;

      if (!mongoose.isValidObjectId(updatedById)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(updatedById);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      await updateFoodWastage(
        id,
        date,
        breakfast,
        lunch,
        snacks,
        dinner,
        hostelId,
        updatedById
      );

      return sendSuccess(res, UPDATE_DATA);
    }
  );

  //SECTION Controller method to delete FoodWastage by id
  deleteFoodWastageById = asyncHandler(
    async (req: Request, res: Response): Promise<Response<HttpResponse>> => {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) throw new Error(INVALID_ID);

      await deleteFoodWastageById(id);
      return sendSuccess(res, DELETE_DATA);
    }
  );

  //SECTION Controller method to handle food wastage bulk upload
  async foodWastageBulkUpload(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const createdById = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      const file = req.file;

      if (!file) {
        throw new Error(REQUIRED_FIELD("File"));
      }

      // Respond immediately that the file is being processed
      res.status(200).send({
        statusCode: 200,
        message: FILE_ON_PROCESS,
      });

      const fileUrl = await uploadFileToCloudStorage(
        file,
        FOOD_WASTAGE_BULK_UPLOAD_FILES
      );
      const url = fileUrl && fileUrl.Key ? fileUrl?.Key : null;

      // Perform file processing after sending response
      const jsonData = await excelToJson(file.buffer);

      // Call the function to handle bulk upload of the data
      await bulkUploadFoodWastageForHostel(
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


  //SECTION Controller to get food wastage count datewise
  getDateWastage = asyncHandler(
    async (req: Request, res: Response): Promise<Response<HttpResponse>> => {
      const { hostelId, date } = req.body;

      //  Validate hostelId
      if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
        return sendError(res, REQUIRED_FIELD("Valid Hostel ID"));
      }

      // Validate date
      if (!date) {
        return sendError(res, REQUIRED_FIELD("Date"));
      }

      const staffId = req.body._valid._id;
      const { staff } = await getStaffById(staffId);
      if (!staff) {
        return sendError(res, RECORD_NOT_FOUND("Staff"));
      }

      const data = await getDateWiseWastageCount(
        hostelId as string,
        date as string
      );

      return sendSuccess(res, FETCH_SUCCESS, data);
    }
  );
}

export default new FoodWastageController();
