import mongoose from "mongoose";
import { Request, Response } from "express";
import AmenitiesService from "../services/amenitie.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";

const {
  createNewAmenities,
  getAllAmenitiesWithPagination,
  getAmenitieById,
  updateAmenitieDetails,
  deleteAmenitieById,
  getAmenitieByName,
} = AmenitiesService;

const { getStaffById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS, UPDATE_DATA, DELETE_DATA } =
  SUCCESS_MESSAGES;
const { REQUIRED_FIELD, INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class AmenitiesController {

  //SECTION Controller method to handle amenities creation
  async createNewAmenities(
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

      const { name } = req.body;

      if (!name) {
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: REQUIRED_FIELD(name),
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new course
      await createNewAmenities(name, createdById);

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

  //SECTION Controller method to get amenities with optional pagination and search
  async getAllAmenitiesWithPagination(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { page, limit, search } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to retrieve amenities
      const { amenities, count } = await getAllAmenitiesWithPagination(
        parsedPage,
        parsedLimit,
        search as string
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: amenities,
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

  //SECTION Controller method to get amenitie by id
  async getAmenitieById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve amenitie
      const { amenitie } = await getAmenitieById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: amenitie,
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

  //SECTION Controller method to update amenitie by id
  async updateAmenitieDetails(
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

      const { name, status } = req.body;

      if (!name) {
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: REQUIRED_FIELD(name),
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to update a new amenitie
      await updateAmenitieDetails(id, name, updatedById, status);

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

  //SECTION Controller method to delete amenitie by id
  async deleteAmenitieById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to delete amenitie
      await deleteAmenitieById(id);

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

  //SECTION Controller method to get amenitie by name
  async getAmenitieByName(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { name } = req.body;

      // Call the service to retrieve amenitie
      const { course } = await getAmenitieByName(name);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: course,
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

export default new AmenitiesController();
