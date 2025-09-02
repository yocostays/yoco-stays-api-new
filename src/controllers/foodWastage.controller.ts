import mongoose from "mongoose";
import { Request, Response } from "express";
import FoodWastageService from "../services/foodWastage.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { MealCountReportType, SortingTypes } from "../utils/enum";
import { excelToJson } from "../utils/excelToJson";
import { uploadFileToCloudStorage } from "../utils/awsUploadService";
import { FOOD_WASTAGE_BULK_UPLOAD_FILES } from "../utils/s3bucketFolder";

const {
  createFoodWastage,
  getAllFoodWastage,
  getFoodWastageById,
  updateFoodWastage,
  deleteFoodWastageById,
  bulkUploadFoodWastageForHostel,
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
  //SECTION Controller to create FoodWastage
  async createFoodWastage(
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

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { startDate, endDate, breakfast, lunch, snacks, dinner } = req.body;

      await createFoodWastage(
        startDate,
        endDate,
        breakfast,
        lunch,
        snacks,
        dinner,
        hostelId,
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

  //SECTION Controller to get all FoodWastage
  async getAllFoodWastage(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      const { page, limit, mealType, sort, startDate, endDate } = req.query;

      if (!mongoose.isValidObjectId(createdById)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }
      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);
      const { data, count } = await getAllFoodWastage(
        parsedPage,
        parsedLimit,
        mealType as MealCountReportType,
        sort as SortingTypes,
        hostelId as string,
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

  //SECTION Controller method to get FoodWastage by id
  async getFoodWastageById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve course
      const { data } = await getFoodWastageById(id);

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

  //SECTION Controller to create FoodWastage
  async updateFoodWastage(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;
      const { id } = req.params;

      if (
        !mongoose.isValidObjectId(createdById) ||
        !mongoose.isValidObjectId(hostelId) ||
        !mongoose.isValidObjectId(id)
      )
        throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }
      const { startDate, endDate, breakfast, lunch, snacks, dinner } = req.body;
      await updateFoodWastage(
        id,
        startDate,
        endDate,
        breakfast,
        lunch,
        snacks,
        dinner,
        hostelId,
        createdById
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

  //SECTION Controller method to get FoodWastage by id
  async deleteFoodWastageById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve course
      await deleteFoodWastageById(id);

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
}

export default new FoodWastageController();
