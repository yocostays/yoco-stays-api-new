import mongoose from "mongoose";
import { Request, Response } from "express";
import TemplateService from "../services/template.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { TemplateTypes } from "../utils/enum";

const { createNewTemplate, getAllTemplates, getTemplateById, updateTemplate } =
  TemplateService;

const { getStaffById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS, UPDATE_DATA, DELETE_DATA } =
  SUCCESS_MESSAGES;
const { REQUIRED_FIELD, INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class TemplateController {
  //SECTION Controller method to handle template creation
  async createNewTemplate(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid?._id;
      if (createdById && !mongoose.isValidObjectId(createdById))
        throw new Error(INVALID_ID);

      if (createdById) {
        // Call the service to retrieve staff
        const { staff } = await getStaffById(createdById);
        if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { hostelId, title, description, image, templateType } = req.body;

      if (!hostelId || !title || !description || !templateType) {
        const missingField = !hostelId
          ? "Hostel Id"
          : !title
          ? "Title"
          : !description
          ? "Description"
          : "Template Type";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: REQUIRED_FIELD(missingField),
        };
        return res.status(400).json(errorResponse);
      }

      await createNewTemplate(
        hostelId,
        title,
        description,
        templateType,
        createdById,
        image
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

  //SECTION Controller method to get roles with optional pagination and search
  async getAllTemplate(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { page, limit, search, hostelId, templateType } = req.query;

      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      const { templates, count } = await getAllTemplates(
        parsedPage,
        parsedLimit,
        search as string,
        hostelId as string,
        templateType as TemplateTypes
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: templates,
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

  //SECTION Controller method to get template by id
  async getTemplateById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve roles
      const { template } = await getTemplateById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: template,
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

  //SECTION Controller method to update template by id
  async updateTemplateDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      const updatedById = req.body._valid._id;
      if (
        !mongoose.isValidObjectId(updatedById) ||
        !mongoose.isValidObjectId(id)
      ) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(updatedById);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { hostelId, title, description, image, templateType } = req.body;

      // Call the service to update a new role
      await updateTemplate(
        id,
        hostelId,
        title,
        description,
        image,
        templateType,
        updatedById
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
}

export default new TemplateController();
