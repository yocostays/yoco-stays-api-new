import mongoose from "mongoose";
import { Request, Response } from "express";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";
import { ReportDropDownTypes, UserGetByTypes } from "../utils/enum";
const {
  staffWithPagination,
  getStaffById,
  assignHostelToWarden,
  hostelForWarden,
  deleteStaffById,
  updateNewStaffById,
  maintanceStaffs,
  createNewStaff,
  staffDetailsByType,
  staffIndisciplinaryAction,
  inactiveStaffById,
  fetchAllStaffForWarden,
  checkUsernameExists,
  fetchStaffActiveHostelDetails,
} = StaffService;

const { FETCH_SUCCESS, CREATE_DATA, UPDATE_DATA, DELETE_DATA } =
  SUCCESS_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
class StaffController {
  //SECTION Controller method to handle staff creation in warden panel
  async createNewStaff(
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

      const {
        roleId,
        categoryId,
        name,
        userName,
        image,
        email,
        phone,
        dob,
        bloodGroup,
        joiningDate,
        gender,
        fatherName,
        motherName,
        spouseName,
        assignedHostelIds,
        hostelDetails,
        shiftStartTime,
        shiftEndTime,
        vechicles,
        kycDocuments,
      } = req.body;

      if (
        !roleId ||
        !name ||
        !userName ||
        !image ||
        !email ||
        !phone ||
        !dob ||
        !bloodGroup ||
        !joiningDate ||
        !gender ||
        !fatherName ||
        !vechicles ||
        !kycDocuments ||
        !shiftStartTime ||
        !shiftEndTime
      ) {
        const missingField = !roleId
          ? "Role Id"
          : !name
            ? "Name"
            : !userName
              ? "Username"
              : !email
                ? "Email"
                : !phone
                  ? "Phone"
                  : !gender
                    ? "Gender"
                    : !image
                      ? "Image"
                      : !dob
                        ? "Date of Birth"
                        : !bloodGroup
                          ? "Blood Group"
                          : !vechicles
                            ? "Vehicle Details"
                            : !kycDocuments
                              ? "KYC Documents"
                              : !joiningDate
                                ? "Joining Date"
                                : !shiftStartTime
                                  ? "Shift start Time"
                                  : !shiftEndTime
                                    ? "Shift end Time"
                                    : "Unknown Field";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new user
      await createNewStaff(
        roleId,
        name,
        userName,
        image,
        email,
        phone,
        dob,
        bloodGroup,
        joiningDate,
        gender,
        fatherName,
        motherName,
        spouseName,
        shiftStartTime,
        shiftEndTime,
        vechicles,
        kycDocuments,
        assignedHostelIds,
        hostelDetails,
        categoryId,
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

  //SECTION Controller method to get staff with optional pagination and search
  async getAllStaffsWithPagination(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const hostelId = req.body._valid?.hostelId;

      if (hostelId && !mongoose.isValidObjectId(hostelId))
        throw new Error(INVALID_ID);

      const { page, limit, search, roles, status, dateRange } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to retrieve roles
      const { staffs, counts } = await staffWithPagination(
        parsedPage,
        parsedLimit,
        status as UserGetByTypes,
        search as string,
        roles as string,
        hostelId as string,
        dateRange as ReportDropDownTypes
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count: counts,
        data: staffs,
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

  //SECTION Controller method to get staff by id
  async getStaffDetailsById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: staff,
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

  //SECTION Controller method to assign hostel to the warden
  async assignHostelToWarden(
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

      const { hostelIds, staffId } = req.body;

      await assignHostelToWarden(hostelIds, staffId);

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

  //SECTION Controller method to get hostel details of staff
  async getHostelOfTheWarden(
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

      const { userId } = req.body;

      const user = userId ? userId : staffId;

      const { hostels } = await hostelForWarden(user, hostelId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: hostels,
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

  //SECTION Controller method to delete staff by id
  async deleteStaffById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to delete hostel by id
      await deleteStaffById(id);

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

  //SECTION Controller method to update staff by id
  async updateStaffDetailsById(
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

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const {
        roleId,
        categoryId,
        name,
        userName,
        image,
        email,
        phone,
        dob,
        bloodGroup,
        joiningDate,
        gender,
        fatherName,
        motherName,
        spouseName,
        assignedHostelIds,
        floorNumber,
        roomNumber,
        shiftStartTime,
        shiftEndTime,
        vechicles,
        kycDocuments,
        hostelDetails,
        status,
      } = req.body;

      if (
        !roleId ||
        !name ||
        !userName ||
        !image ||
        !email ||
        !phone ||
        !dob ||
        !bloodGroup ||
        !joiningDate ||
        !gender ||
        !fatherName ||
        !vechicles ||
        !kycDocuments ||
        !shiftStartTime ||
        !shiftEndTime
      ) {
        const missingField = !roleId
          ? "Role Id"
          : !name
            ? "Name"
            : !userName
              ? "Username"
              : !email
                ? "Email"
                : !phone
                  ? "Phone"
                  : !gender
                    ? "Gender"
                    : !image
                      ? "Image"
                      : !dob
                        ? "Date of Birth"
                        : !bloodGroup
                          ? "Blood Group"
                          : !vechicles
                            ? "Vehicle Details"
                            : !kycDocuments
                              ? "KYC Documents"
                              : !joiningDate
                                ? "Joining Date"
                                : !shiftStartTime
                                  ? "Shift start Time"
                                  : !shiftEndTime
                                    ? "Shift end Time"
                                    : "Unknown Field";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to update a new staff
      await updateNewStaffById(
        id,
        roleId,
        name,
        userName,
        image,
        email,
        phone,
        dob,
        bloodGroup,
        joiningDate,
        gender,
        fatherName,
        motherName,
        spouseName,
        shiftStartTime,
        shiftEndTime,
        vechicles,
        kycDocuments,
        status,
        assignedHostelIds,
        hostelDetails,
        categoryId,
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

  //SECTION Controller method to get all maintance staff
  async getAllMaintanceStaffs(
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

      const { compaintId, categoryType } = req.body;
      
      const { staffs } = await maintanceStaffs(
        compaintId,
        categoryType,
        hostelId
      );


      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: staffs,
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

  //SECTION Controller method to get staff details for admin and warden panel
  async fetchStaffDetailsByIdAndType(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { staffId, type } = req.body;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { details } = await staffDetailsByType(staffId, type);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: details,
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

  //SECTION Controller method to update staff indisciplinary action
  async indisciplinaryActionUpdate(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;

      if (!mongoose.isValidObjectId(userId)) throw new Error(INVALID_ID);

      const { staff } = await getStaffById(userId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { staffId, remark, isFine, fineAmount } = req.body;

      // Call the service to update Indisciplinary
      await staffIndisciplinaryAction(
        staffId,
        remark,
        isFine,
        fineAmount,
        userId
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

  //SECTION Controller method to inactive staff by id
  async inactiveStaff(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const updatedById = req.body._valid._id;

      if (!mongoose.isValidObjectId(updatedById)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(updatedById);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { staffId } = req.body;

      // Call the service to inactive staff by id
      await inactiveStaffById(staffId, updatedById);

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

  //SECTION Controller method to get staff with optional pagination and search
  async fetchAllStaffForWarden(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const hostelId = req.body._valid?.hostelId;

      if (hostelId && !mongoose.isValidObjectId(hostelId))
        throw new Error(INVALID_ID);

      const { page, limit, search, role, status } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to retrieve roles
      const { staffs, count } = await fetchAllStaffForWarden(
        parsedPage,
        parsedLimit,
        hostelId,
        status as UserGetByTypes,
        role as string,
        search as string
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: staffs,
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

  //SECTION Controller method to check User name Exists
  async checkUsernameExists(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid?._id;

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { userName } = req.body;
      const { isUserNameExist } = await checkUsernameExists(userName);
      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: isUserNameExist,
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

  //SECTION Controller method to check User active hostel details
  async fetchStaffActiveHostelDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid?._id;
      const hostelId = req.body._valid?.hostelId;

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { details } = await fetchStaffActiveHostelDetails(hostelId);
      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: details,
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

export default new StaffController();
