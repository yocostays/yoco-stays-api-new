import mongoose from "mongoose";
import { Request, Response } from "express";
import ComplainCategoryService from "../services/complainCategory.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";

const { getStaffById } = StaffService;
const { createNewComplainCategory, getAllComplainCategory } =
  ComplainCategoryService;

const { CREATE_DATA, FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class ComplainCategoryController {
  //SECTION Controller method to handle ComplainCategory creation
  async createNewComplainCategory(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;
      if (!mongoose.isValidObjectId(createdById)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { categories } = req.body;

      // Call the service to create a new category
      await createNewComplainCategory(categories, createdById);

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

  //SECTION Controller method to handle ComplainCategory get
  async getAllComplainCategory(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {

      const { roleId } = req.body;
      // Call the service to create a new category
      const { categories } = await getAllComplainCategory(roleId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: categories,
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

export default new ComplainCategoryController();
