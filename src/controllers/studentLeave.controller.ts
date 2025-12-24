import mongoose from "mongoose";
import { Request, Response } from "express";
import StudentLeaveService from "../services/studentLeave.service";
import StaffService from "../services/staff.service";
import UserService from "../services/user.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import {
  LeaveStatusTypes,
  LeaveTypes,
  ReportDropDownTypes,
  SortingTypes,
} from "../utils/enum";
import { leaveValidationSchema } from "../utils/validators/leaveValidation.validatior";

const { getStaffById } = StaffService;
const { getStudentById } = UserService;
const {
  applyleaveFromApp,
  userLeaveByStatus,
  userLeaveLogs,
  getAllLeaveByStaffRole,
  leaveDetailsById,
  updateLeaveStatus,
  applyOutingFromApp,
  approvedLeaveDetailsById,
  cancelLeaveById,
  fetchIndividualUserLeaveDetails,
  bulkUpdateLeaveStatus,
  retrieveStudentCurrentlyOut,
} = StudentLeaveService;

const { CREATE_DATA, FETCH_SUCCESS, UPDATE_DATA } = SUCCESS_MESSAGES;
const { INVALID_ID, INVALID_PAYLOAD, LEAVE_UPDATE_ISSUES } =
  VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class StudentLeaveController {
  //SECTION Controller method to handle apply student leave
  async studentApplyLeave(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { error } = leaveValidationSchema.validate(req.body, {
        abortEarly: false,
      });
     
      if (error) {
        return res.status(400).json({
          message: error.details[0].message,
          statusCode: 400,
        });
      }
   

      const userId = req.body._valid._id;
      if (!mongoose.isValidObjectId(userId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { student } = await getStudentById(userId);

      if (!student) {
        throw new Error(RECORD_NOT_FOUND("Student"));
      }

      const { categoryId, startDate, endDate, days, description, hours } = req.body;
      if (
        !categoryId ||
        !startDate ||
        !endDate ||
        description === undefined ||
        description === null ||
        days === undefined ||
        days === null ||
        hours === undefined ||
        hours === null
      ) {
        const missingField =
          !categoryId
            ? "Category"
            : !startDate
              ? "Start Date"
              : !endDate
                ? "End Date"
                : description === undefined || description === null
                  ? "Description"
                  : days === undefined || days === null
                    ? "Days"
                    : hours === undefined || hours === null
                      ? "Hours"
                      : "";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };

        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new category
      await applyleaveFromApp(
        userId,
        student?.hostelId,
        categoryId,
        startDate,
        endDate,
        days,
        hours,
        description
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

  //SECTION Controller method to handle leave get in app
  async getUserLeaveByStatus(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;

      if (!mongoose.isValidObjectId(userId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve Student
      const { student } = await getStudentById(userId);

      if (!student) {
        throw new Error(RECORD_NOT_FOUND("Student"));
      }

      const { page, limit, status, type } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to get Complain
      const { leaves, count } = await userLeaveByStatus(
        userId,
        parsedPage,
        parsedLimit,
        type as LeaveTypes,
        status as LeaveStatusTypes
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: leaves,
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
  async getLeaveLogs(
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

      const { leaveId } = req.body;

      // Call the service to get Complaint logs
      const { logs } = await userLeaveLogs(leaveId);

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

  //SECTION Controller method to handle get All Leave In warden Panel Or Admin
  async getAllLeaveInwardenPanelOrAdmin(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      const {
        page,
        limit,
        status,
        leaveStatus,
        search,
        sort,
        floorNumber,
        roomNumber,
        startDate,
        endDate
      } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      // Call the service to get leavs
      const { details, count } = await getAllLeaveByStaffRole(
        parsedPage,
        parsedLimit,
        status as LeaveTypes,
        staff.roleId?.name,
        hostelId,
        leaveStatus as LeaveStatusTypes,
        search as string,
        sort as SortingTypes,
        floorNumber as string,
        roomNumber as string,
        startDate as string,
        endDate as string
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
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

  //SECTION Controller method to handle get leave by Id
  async getLeaveById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      const { id } = req.params;

      if (!mongoose.isValidObjectId(staffId) || !mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to get leave by id
      const { leave } = await leaveDetailsById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: leave,
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

  //SECTION Controller method to update leave in warden panel
  async updateLeaveStatusById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const { id } = req.params;

      if (!mongoose.isValidObjectId(staffId) || !mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      const { status, remark } = req.body;

      // Call the service to update the leave status
      await updateLeaveStatus(staffId, id, status as LeaveStatusTypes, remark);

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

  //SECTION Controller method to handle apply student day and night out
  async studentApplyOuting(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;
      if (!mongoose.isValidObjectId(userId)) throw new Error(INVALID_ID);

      // Call the service to retrieve student
      const { student } = await getStudentById(userId);

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      const {
        categoryId,
        startDate,
        endDate,
        hours,
        description,
        visitorName,
        visitorNumber,
        leaveType,
      } = req.body;

      // If leaveType is day out, categoryId is required
      if (
        (leaveType === LeaveTypes.DAY_OUT && !categoryId) ||
        !startDate ||
        !endDate ||
        !description ||
        !hours ||
        !leaveType
      ) {
        const missingField =
          leaveType === LeaveTypes.DAY_OUT && !categoryId
            ? "Category"
            : !startDate
              ? "Start Date"
              : !endDate
                ? "End Date"
                : !hours
                  ? "Hours"
                  : !leaveType
                    ? "Leave Type"
                    : "Description";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create outing
      await applyOutingFromApp(
        leaveType,
        userId,
        student?.hostelId,
        startDate,
        endDate,
        hours,
        description,
        visitorName,
        visitorNumber,
        categoryId
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

  //SECTION Controller method to handle get approve leave by Id for app
  async gatepassDetailsForApp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const studentId = req.body._valid._id;

      const { leaveId } = req.body;

      if (
        !mongoose.isValidObjectId(studentId) ||
        !mongoose.isValidObjectId(leaveId)
      )
        throw new Error(INVALID_ID);

      // Call the service to get leave by id
      const { leave } = await approvedLeaveDetailsById(leaveId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: leave,
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

  //SECTION Controller method to handle cancel leave by leaveId
  async cancelComplaintById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;

      if (!mongoose.isValidObjectId(userId)) throw new Error(INVALID_ID);

      // Call the service to retrieve student
      const { student } = await getStudentById(userId);

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      const { leaveId } = req.body;

      // Call the service to cancell leave by id
      await cancelLeaveById(leaveId, userId);

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

  //SECTION Controller method to handle leave get in app
  async fetchIndividualUserLeaveDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve Student
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const {
        page,
        limit,
        userId,
        status,
        leaveStatus,
        durationType,
        startDate,
        endDate,
      } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to get Complain
      const { leaves, count } = await fetchIndividualUserLeaveDetails(
        userId as string,
        parsedPage,
        parsedLimit,
        status as LeaveTypes,
        leaveStatus as LeaveStatusTypes,
        durationType as ReportDropDownTypes,
        startDate as string,
        endDate as string
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: leaves,
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

  //SECTION Controller method to update leave in warden panel
  async bulkUpdateLeaveStatus(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);
      // Call the service to retrieve Student
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { leaves } = req.body;

      // Check if `leaves` is an array and validate its contents
      if (!Array.isArray(leaves) || leaves.length === 0)
        throw new Error(INVALID_PAYLOAD);

      // Validate each leave object using `map`
      const invalidLeave = leaves
        .map((leave) => {
          return (
            typeof leave !== "object" ||
            !leave.leaveId ||
            !Object.values(LeaveStatusTypes).includes(leave.status) ||
            typeof leave.remark !== "string"
          );
        })
        .some((isInvalid) => isInvalid);

      if (invalidLeave) {
        throw new Error(LEAVE_UPDATE_ISSUES);
      }

      // Call the service to update the leave status
      await bulkUpdateLeaveStatus(staffId, leaves);

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

  //SECTION Controller method to get currect student on leave
  async retrieveStudentCurrentlyOut(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);
      // Call the service to retrieve Student
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { durationType, search, startDate, endDate } = req.body;

      // Call the service retrive Student Currently Out
      const { users } = await retrieveStudentCurrentlyOut(
        hostelId,
        search,
        durationType,
        startDate,
        endDate
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: users,
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

export default new StudentLeaveController();
