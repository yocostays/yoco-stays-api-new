import { Request, Response } from "express";
import ComplainSubCategoryService from "../services/complainSubCategory.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";

const { createNewComplainSubCategory, getAllComplainSubCategory } =
  ComplainSubCategoryService;

const { CREATE_DATA, FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class ComplainSubCategoryController {
  //SECTION Controller method to handle Complain sub Category creation
  async createNewComplainSubCategory(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { categoryId, values } = req.body;

      // Call the service to create a new category
      await createNewComplainSubCategory(categoryId, values);

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

  //SECTION Controller method to handle Complain sub Category get
  async getAllComplainSubCategory(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { categoryId } = req.body;
      // Call the service to create a new category
      const { subCategories } = await getAllComplainSubCategory(categoryId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: subCategories,
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

export default new ComplainSubCategoryController();
