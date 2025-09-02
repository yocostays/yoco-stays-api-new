import mongoose from "mongoose";
import { Request, Response } from "express";
import RoutesService from "../services/routes.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";

const { createNewRoutes, allRoutesDetails,deleteRouteById } = RoutesService;

const { getStaffById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS, DELETE_DATA } = SUCCESS_MESSAGES;
const { REQUIRED_FIELD, INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class RoutesController {
  //SECTION Controller method to handle routes creation
  async createNewRoutes(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { title, link, icon } = req.body;

      if (!title || !link || !icon) {
        const missingField = !title ? "title" : !link ? "link" : "icon";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: REQUIRED_FIELD(missingField),
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new routes
      await createNewRoutes(title, link, icon);

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

  //SECTION Controller method to handle get all routes
  async getAllRoutes(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Call the service to create a new routes
      const { count, routes } = await allRoutesDetails();

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: routes,
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

  //SECTION Controller method to delete route by id
  async deleteRouteById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) throw new Error(INVALID_ID);

      // Call the service to delete roles
      await deleteRouteById(id);

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
}

export default new RoutesController();
