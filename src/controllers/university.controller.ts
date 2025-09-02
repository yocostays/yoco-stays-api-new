import mongoose from "mongoose";
import { Request, Response } from "express";
import UniversityService from "../services/university.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import {
  validateArray,
  validateLocation,
  validateNumber,
  validateObjectId,
  validateRequiredField,
} from "../utils/validationUtils";

const {
  createNewCollege,
  getAllCollegesWithPagination,
  getCollegeById,
  deleteCollegeById,
  updateCollegeById,
  allUniversityWithoutPagination,
  courseDetailsByUniversityId,
} = UniversityService;

const { getStaffById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS, UPDATE_DATA, DELETE_DATA } =
  SUCCESS_MESSAGES;
const { INVALID_FIELD, INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class CollegeController {
  //SECTION Controller method to handle course creation
  async createNewCollege(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;

      // Validate createdById
      let validationError = validateObjectId(createdById, "createdById");
      if (validationError) {
        throw new Error(validationError);
      }

      // Retrieve staff
      const { staff } = await getStaffById(createdById);
      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const {
        totalCapacity,
        name,
        address,
        googleMapLink,
        location,
        courseIds,
        hostelDetails,
        roomTypes,
        paymentTypes,
        mealTypes,
        evChargingStation,
        parkingSpaces,
      } = req.body;

      // Perform validations
      const validations = [
        validateRequiredField(totalCapacity, "totalCapacity"),
        validateRequiredField(name, "name"),
        validateRequiredField(address, "address"),
        validateRequiredField(googleMapLink, "googleMapLink"),
        validateLocation(location),
        validateArray(courseIds, "courseIds"),
        validateArray(roomTypes, "roomTypes"),
        validateArray(paymentTypes, "paymentTypes"),
        validateArray(mealTypes, "mealTypes"),
        validateNumber(evChargingStation, "evChargingStation"),
        validateNumber(parkingSpaces, "parkingSpaces"),
      ];

      // Check for any validation errors
      validationError = validations.find((error) => error !== null) ?? null;
      if (validationError) {
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: validationError,
        };
        return res.status(400).json(errorResponse);
      }

      // Validate hostelDetails
      if (
        !Array.isArray(hostelDetails) ||
        hostelDetails.some(
          (hostel) =>
            !hostel.hostelType ||
            !hostel.noOfBuildings ||
            !hostel.noOfBeds ||
            typeof hostel.noOfBuildings !== "number" ||
            typeof hostel.noOfBeds !== "number"
        )
      ) {
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: INVALID_FIELD("hostelDetails"),
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new college
      await createNewCollege(
        totalCapacity,
        name,
        address,
        googleMapLink,
        location,
        courseIds,
        hostelDetails,
        roomTypes,
        paymentTypes,
        mealTypes,
        evChargingStation,
        parkingSpaces,
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

  //SECTION Controller method to get college with optional pagination and search
  async getAllCollegesWithPagination(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { page, limit, search } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to retrieve courses
      const { colleges, count } = await getAllCollegesWithPagination(
        parsedPage,
        parsedLimit,
        search as string
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: colleges,
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

  //SECTION Controller method to get college by id
  async getCollegeById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve college
      const { college } = await getCollegeById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: college,
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

  //SECTION Controller method to delete college by id
  async deleteCollegeById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updatedById = req.body._valid._id;

      if (
        !mongoose.isValidObjectId(id) ||
        !mongoose.isValidObjectId(updatedById)
      ) {
        throw new Error(INVALID_ID);
      }
      // Retrieve staff
      const { staff } = await getStaffById(updatedById);
      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      // Call the service to delete college
      const { message } = await deleteCollegeById(id, status, updatedById);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message,
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

  //SECTION Controller method to update college by id
  async updateCollegeDetails(
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

      const {
        totalCapacity,
        name,
        address,
        googleMapLink,
        location,
        courseIds,
        hostelDetails,
        roomTypes,
        paymentTypes,
        mealTypes,
        evChargingStation,
        parkingSpaces,
        status,
      } = req.body;

      if (
        !totalCapacity ||
        !name ||
        !address ||
        !googleMapLink ||
        !location ||
        !courseIds ||
        !hostelDetails ||
        !roomTypes ||
        !paymentTypes ||
        !mealTypes ||
        !evChargingStation ||
        !parkingSpaces
      ) {
        const missingField = !totalCapacity
          ? "Total Capacity"
          : !name
          ? "Name"
          : !address
          ? "Address"
          : !googleMapLink
          ? "googleMapLink"
          : !location
          ? "location"
          : !courseIds
          ? "courseIds"
          : !hostelDetails
          ? "hostelDetails"
          : !roomTypes
          ? "roomTypes"
          : !paymentTypes
          ? "paymentTypes"
          : !mealTypes
          ? "mealTypes"
          : !evChargingStation
          ? "evChargingStation"
          : "parkingSpaces";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to update a new course
      await updateCollegeById(
        id,
        totalCapacity,
        name,
        address,
        googleMapLink,
        location,
        courseIds,
        hostelDetails,
        roomTypes,
        paymentTypes,
        mealTypes,
        evChargingStation,
        parkingSpaces,
        updatedById,
        status
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

  //SECTION Controller method to get all university
  async allUniversityWithoutPagination(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      // Call the service to retrieve courses
      const { university } = await allUniversityWithoutPagination();

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: university,
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

  //SECTION Controller method to get all university
  async courseDetailsByUniversityId(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);
      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { universityId } = req.body;

      // Call the service to retrieve courses
      const { courses } = await courseDetailsByUniversityId(universityId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: courses,
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

export default new CollegeController();
