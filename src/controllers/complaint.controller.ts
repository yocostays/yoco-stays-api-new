import mongoose from "mongoose";
import { Request, Response } from "express";
import ComplaintService from "../services/complaint.service";
import StaffService from "../services/staff.service";
import UserService from "../services/user.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { ComplainStatusTypes, SortingTypes } from "../utils/enum";

const { getStaffById } = StaffService;
const { getStudentById } = UserService;
const {
  createNewComplainForApp,
  complaintByStatus,
  allocateStaffToComplaint,
  compaintStatusUpdate,
  userComplaintsByStatus,
  complaintLogs,
  cancelComplaint,
  complaintDetailsById,
  individualStudentComplaints,
  bulkUpdateComplainStatus,
} = ComplaintService;

const { CREATE_DATA, FETCH_SUCCESS, UPDATE_DATA } = SUCCESS_MESSAGES;
const { INVALID_ID, INVALID_PAYLOAD, COMPLAIN_UPDATE_ISSUES } =
  VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class ComplainController {
  //SECTION Controller method to handle ComplainCategory creation
  async createNewComplainInApp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;
      if (!mongoose.isValidObjectId(userId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { student } = await getStudentById(userId);

      if (!student) {
        throw new Error(RECORD_NOT_FOUND("Student"));
      }

      const { categoryId, subCategoryId, description, image, audio } = req.body;

      if (!categoryId || !subCategoryId || !description) {
        const missingField = !categoryId
          ? "Category"
          : !subCategoryId
          ? "Sub Category"
          : "Description";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new category
      await createNewComplainForApp(
        userId,
        student?.hostelId,
        categoryId,
        subCategoryId,
        description,
        image,
        audio
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

  //SECTION Controller method to handle Complain get in warden
  async getAllComplaintByStatus(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const {
        page,
        limit,
        status,
        categoryId,
        sort,
        startDate,
        endDate,
        search,
        floorNumber,
        roomNumber,
      } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to get Complain
      const { complaint, count } = await complaintByStatus(
        staffId,
        parsedPage,
        parsedLimit,
        status as ComplainStatusTypes,
        staff.roleId?.name,
        hostelId,
        categoryId as string,
        sort as SortingTypes,
        startDate as string,
        endDate as string,
        search as string,
        floorNumber as string,
        roomNumber as string
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: complaint,
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

  //SECTION Controller method to assign staff in case of escalation
  async assignMaintanceStaffs(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      
      const userId = req.body._valid._id;
      if (!mongoose.isValidObjectId(userId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(userId);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { staffId, complaintId, remark,usersId } = req.body;

      if (!staffId || !complaintId || !remark) {
        const missingFields = [];
        if (!staffId) missingFields.push("Staff Id");
        if (!complaintId) missingFields.push("Complaint Id");
        if (!remark) missingFields.push("Remark");

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingFields.join(", ")} is required.`,
        };

        return res.status(400).json(errorResponse);
      }

      // Call the service to assign staff
      await allocateStaffToComplaint(usersId, staffId, complaintId, remark);

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

  //SECTION Controller method to handle ComplainCategory creation
  async compaintStatusUpdate(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;
      if (!mongoose.isValidObjectId(userId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(userId);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { complaintId, complainStatus, remark, attachments } = req.body;

      if (!complainStatus || !complaintId) {
        const missingField = !complainStatus
          ? "Complain Status"
          : "Complaint id";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to upadte status
      await compaintStatusUpdate(
        userId,
        complainStatus,
        remark,
        complaintId,
        attachments
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

  //SECTION Controller method to handle Complain get in for user
  async getUserComplaintByStatus(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;

      if (!mongoose.isValidObjectId(userId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve student
      const { student } = await getStudentById(userId);

      if (!student) {
        throw new Error(RECORD_NOT_FOUND("Student"));
      }

      const { status } = req.body;

      // Call the service to get Complain
      const { complaints } = await userComplaintsByStatus(
        userId,
        status as ComplainStatusTypes
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: complaints,
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

  //SECTION Controller method to handle Complain get in for user
  async getComplaintLogs(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;

      if (!mongoose.isValidObjectId(userId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve student
      const { student } = await getStudentById(userId);

      if (!student) {
        throw new Error(RECORD_NOT_FOUND("Student"));
      }

      const { compaintId } = req.body;

      // Call the service to get Complaint logs
      const { logs } = await complaintLogs(compaintId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: logs,
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

  //SECTION Controller method to handle cancel Complaint by complaintId
  async cancelComplaintById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;

      if (!mongoose.isValidObjectId(userId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve student
      const { student } = await getStudentById(userId);

      if (!student) {
        throw new Error(RECORD_NOT_FOUND("Student"));
      }

      const { compaintId } = req.body;

      // Call the service to get Complaint logs
      await cancelComplaint(compaintId, userId);

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

  //SECTION Controller method to handle get complaint by Id
  async getStudentComplaintById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      const { id } = req.params;

      if (!mongoose.isValidObjectId(staffId) || !mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to get complaint by id
      const { complaint } = await complaintDetailsById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: complaint,
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

  //SECTION Controller method to get individual Student Complaints
  async individualStudentComplaints(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid.hostelId;

      const { userId, page, limit, filter, startDate, endDate } = req.body;

      if (
        !mongoose.isValidObjectId(staffId) ||
        !mongoose.isValidObjectId(userId) ||
        !mongoose.isValidObjectId(hostelId)
      ) {
        throw new Error(INVALID_ID);
      }

      // Call the service to get complaint for student
      const { complaints, count } = await individualStudentComplaints(
        hostelId,
        userId,
        page,
        limit,
        filter,
        startDate,
        endDate
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: complaints,
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

  //SECTION Controller method to update complain in warden panel
  async bulkUpdateComplainStatus(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);
      // Call the service to retrieve Student
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { compaints } = req.body;

      // Check if `compaints` is an array and validate its contents
      if (!Array.isArray(compaints) || compaints.length === 0)
        throw new Error(INVALID_PAYLOAD);

      // Validate each compaint object using `map`
      const invalidUpdate = compaints
        .map((ele) => {
          return (
            typeof ele !== "object" ||
            !ele.complaintId ||
            !Object.values(ComplainStatusTypes).includes(ele.status) ||
            typeof ele.remark !== "string"
          );
        })
        .some((isInvalid) => isInvalid);

      if (invalidUpdate) {
        throw new Error(COMPLAIN_UPDATE_ISSUES);
      }

      // Call the service to update the complain status
      await bulkUpdateComplainStatus(staffId, compaints);

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

export default new ComplainController();
