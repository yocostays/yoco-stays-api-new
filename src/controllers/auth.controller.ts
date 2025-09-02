import mongoose from "mongoose";
import { Request, Response } from "express";
import AuthService from "../services/auth.service";
import UserService from "../services/user.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";
import { getSignedUrl } from "../utils/awsUploadService";
import {
  COMPLAIN_FILES,
  SAMPLE_FILE,
  STAFF_FOLDER,
} from "../utils/s3bucketFolder";

const {
  staffLoginWithUserNameAndPwd,
  studentLogin,
  logoutCurrentUser,
  resetStudentPassword,
  uploadFileInApp,
  wardenRefreshToken,
  generateOtp,
  resetStaffPassword,
  downloadSampleBulkUploadFile,
  generateOtpUserSignUp,
  verifyOtpUserSignUp,
} = AuthService;

const { getStudentByUniqueId } = UserService;
const { getStaffById, staffByEmailId } = StaffService;
const {
  FETCH_SUCCESS,
  GENERATE_OTP,
  USER_LOGIN_SUCCESS,
  USER_LOGOUT_SUCCESS,
  PASSWORD_RESET_SUCCESS,
  FILE_UPLOADED,
  REFRESH_TOKEN,
  VERIFY_OTP,
} = SUCCESS_MESSAGES;
const { REQUIRED_FIELD, INVALID_ID } = VALIDATION_MESSAGES;

const { SERVER_ERROR, RECORD_NOT_FOUND, USER_NOT_ACTIVE } = ERROR_MESSAGES;

class AuthController {
  //SECTION Controller method to handle staff login
  async staffLoginWithUserNameAndPwd(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { userName, password } = req.body;

      if (!userName || !password) {
        const missingField = !userName ? "Username" : "Password";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new user
      const { staff, token } = await staffLoginWithUserNameAndPwd(
        userName,
        password
      );

      const result = {
        _id: staff._id,
        name: staff?.name ?? null,
        email: staff?.email ?? null,
        phone: staff?.phone ?? null,
        image: staff?.image ? await getSignedUrl(staff.image) : null,
        role: staff?.roleId?.name ?? null,
        hostelId: staff?.hostelIds[0],
        isHostelAssigned: staff?.hostelIds.length > 0,
      };

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: USER_LOGIN_SUCCESS,
        auth: token,
        data: result,
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

  //SECTION: Controller method to handle student login
  async studentLoginWithIdAndPwd(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const {
        uniqueId,
        password,
        rememberMe,
        loginType,
        subscriptionId,
      } = req.body;

      if (!uniqueId || !password) {
        const missingField = !uniqueId ? "Yoco unique id" : "Password";
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new user
      const { student, token } = await studentLogin(
        uniqueId,
        password,
        rememberMe,
        loginType,
        subscriptionId,
      );

      const result = {
        _id: student._id,
        name: student?.name ?? null,
        email: student?.email ?? null,
        image: student?.image ? await getSignedUrl(student?.image) : null,
        phone: student?.phone ?? null,
        hostel: student?.hostelId?.name ?? null,
      };

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: USER_LOGIN_SUCCESS,
        auth: token,
        data: result,
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

  //SECTION: Controller method to handle logout in complete project
  async logoutFromApplication(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;

      // Call the service to logout User
      await logoutCurrentUser(createdById);

      const successResponse: HttpResponse = {
        statusCode: 401,
        message: USER_LOGOUT_SUCCESS,
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

  //SECTION: Controller method to handle generate code for password reset
  async generateOtpForApp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { uniqueId } = req.body;

      //NOTE - get user by unique Id
      const { student } = await getStudentByUniqueId(uniqueId);

      if (!student) {
        throw new Error(RECORD_NOT_FOUND("Student"));
      }

      if (!student.isVerified) throw new Error(USER_NOT_ACTIVE);

      const mobile = String(student.phone)
      // Call the service to generate otp
      const { otp } = await generateOtp(student._id, mobile);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: GENERATE_OTP,
        data: {
          otp,
          uniqueId: student?.uniqueId,
        },
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

  //SECTION: Controller method to handle reset paswwrod for user
  async resetStudentPasswordInApp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { uniqueId, otp, password } = req.body;

      //NOTE - get user by unique Id
      const { student } = await getStudentByUniqueId(uniqueId);

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      // Call the service to reset User password
      await resetStudentPassword(student._id, password, otp);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: PASSWORD_RESET_SUCCESS,
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

  //SECTION: Controller method to handle upload file in aws
  async uploadImageOrAudio(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const file = req.file;

      if (!file) throw new Error(REQUIRED_FIELD("File"));

      const { type } = req.body;

      const folderName =
        type === "staff"
          ? STAFF_FOLDER
          : type === "sample"
          ? SAMPLE_FILE
          : COMPLAIN_FILES;

      const url = await uploadFileInApp(file, folderName);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FILE_UPLOADED,
        data: url,
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

  //SECTION: Controller method to handle refresh token on warden hostel change
  async generateWardenRefreshToken(
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

      const { hostelId } = req.body;

      // Call the service to get token
      const { token } = await wardenRefreshToken(staff, hostelId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: REFRESH_TOKEN,
        auth: token,
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

  //SECTION: Controller method to handle generate code for password reset of staff
  async generateOtpForwardenPanel(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { email } = req.body;

      //NOTE - get user by email
      const { staff } = await staffByEmailId(email);

      // Call the service to generate otp
      const { otp } = await generateOtp(staff._id,staff.phone);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: GENERATE_OTP,
        data: {
          otp,
          staffId: staff?._id,
        },
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

  //SECTION: Controller method to handle reset paswwrod for staff
  async resetStaffPassword(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { email, otp, password } = req.body;

      //NOTE - get staff by email
      const { staff } = await staffByEmailId(email);

      // Call the service to reset User password
      await resetStaffPassword(staff._id, password, otp);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: PASSWORD_RESET_SUCCESS,
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

  //SECTION: Controller method to handle download Sample Bulk Upload File
  async downloadSampleBulkUploadFile(
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
      const { type } = req.body;

      // Call the service to download file
      const { url } = await downloadSampleBulkUploadFile(type);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: url,
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

  //SECTION: Controller method to generate Otp User Sign Up
  async generateOtpUserSignUp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid?._id;

      if (staffId) {
        if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

        // Call the service to retrieve staff
        const { staff } = await getStaffById(staffId);

        if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { phone } = req.body;

      // Call the service to generate otp
      const { otp } = await generateOtpUserSignUp(phone);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: GENERATE_OTP,
        data: otp,
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

  //SECTION: Controller method to verify otp for user sign up
  async verifyOtpUserSignUp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid?._id;

      if (staffId) {
        if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

        // Call the service to retrieve staff
        const { staff } = await getStaffById(staffId);

        if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { phone, otp } = req.body;

      // Call the service to generate otp
      const { isVerified } = await verifyOtpUserSignUp(phone, otp);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: VERIFY_OTP,
        data: isVerified,
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

export default new AuthController();
