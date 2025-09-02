import mongoose from "mongoose";
import { Request, Response } from "express";
import UserService from "../services/user.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";
import {
  ReportDropDownTypes,
  SortingTypes,
  UserGetByTypes,
} from "../utils/enum";
import { excelToJson } from "../utils/excelToJson";
import { USER_BULK_UPLOAD_FILES } from "../utils/s3bucketFolder";
import { uploadFileToCloudStorage } from "../utils/awsUploadService";

const { getStaffById } = StaffService;
const {
  registerNewUser,
  getStudentById,
  userWithPagination,
  retrieveUsersWithoutHostel,
  assignHostelIndivisualUser,
  updateStudentInApp,
  fetchStudentInfoById,
  modifyVehicleInApp,
  getStudentByUniqueId,
  uploadDocument,
  studentDetailsByType,
  updateAuthorizedUser,
  createUserFromWardenPanel,
  studentIndisciplinaryAction,
  userBulkUpload,
  deleteVehicle,
  updateUserFromWardenPanel,
  usersBasedOnHostelAndAcademic,
  updateUserStatus,
} = UserService;

const {
  FETCH_SUCCESS,
  CREATE_DATA,
  UPDATE_DATA,
  FILE_UPLOADED,
  FILE_ON_PROCESS,
  DELETE_DATA,
} = SUCCESS_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { INVALID_ID, REQUIRED_FIELD } = VALIDATION_MESSAGES;
class UserController {
  //SECTION Controller method to handle user creation
  async registerUserFromApp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const {
        name,
        email,
        phone,
        enrollmentNumber,
        dob,
        fatherName,
        fatherNumber,
        fatherEmail,
        motherName,
        motherNumber,
        motherEmail,
        adharNumber,
        bloodGroup,
        courseName,
        academicYear,
        guardianContactNo,
        category,
        hostelId,
        address,
        semester,
        oneSignalWebId,
        oneSignalAndoridId,
        oneSignalIosId,
      } = req.body;

      if (
        !name ||
        !email ||
        !phone ||
        !enrollmentNumber ||
        !dob ||
        !fatherName ||
        !fatherNumber ||
        !motherName ||
        !motherNumber ||
        !adharNumber ||
        !bloodGroup ||
        !courseName ||
        !academicYear ||
        !guardianContactNo ||
        !category ||
        !hostelId ||
        !address
      ) {
        const missingField = !name
          ? "Name"
          : !email
          ? "Email"
          : !phone
          ? "Phone"
          : !enrollmentNumber
          ? "Enrollment Number"
          : !dob
          ? "Date of Birth"
          : !fatherName
          ? "Father's Name"
          : !fatherNumber
          ? "Father's Number"
          : !motherName
          ? "Mother's Name"
          : !motherNumber
          ? "Mother's Number"
          : !adharNumber
          ? "Adhar Number"
          : !bloodGroup
          ? "Blood Group"
          : !courseName
          ? "Course Name"
          : !academicYear
          ? "Academic Year"
          : !guardianContactNo
          ? "Guardian Contact Number"
          : !category
          ? "Category"
          : !hostelId
          ? "Hostel ID"
          : "Address";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new user
      await registerNewUser(
        name,
        email,
        phone,
        enrollmentNumber,
        dob,
        fatherName,
        fatherNumber,
        motherName,
        motherNumber,
        adharNumber,
        bloodGroup,
        courseName,
        academicYear,
        guardianContactNo,
        category,
        hostelId,
        address,
        fatherEmail,
        motherEmail,
        semester,
        oneSignalWebId,
        oneSignalAndoridId,
        oneSignalIosId
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

  //SECTION Controller method to get student by id
  async getStudentDetailsById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve student
      const { student } = await getStudentById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: student,
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

  //SECTION Controller method to get user with optional pagination and search
  async getAllUsersWithPagination(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const hostelId = req.body._valid?.hostelId;

      const { page, limit, search, status, dateRange, sort, academicYear } =
        req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      if (!status) {
        const missingField = "Status";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to retrieve student
      const { students, counts } = await userWithPagination(
        parsedPage,
        parsedLimit,
        status as UserGetByTypes,
        search as string,
        hostelId,
        dateRange as ReportDropDownTypes,
        sort as SortingTypes,
        academicYear as string
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count: counts,
        data: students,
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

  //SECTION Controller method to get all user ,to whom hostel is not allocated
  async getUsersWithoutHostelAllocation(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const hostelId = req.body._valid?._id;

      if (!mongoose.isValidObjectId(hostelId)) throw new Error(INVALID_ID);

      const { page, limit, search } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to retrieve student
      const { students, count } = await retrieveUsersWithoutHostel(
        parsedPage,
        parsedLimit,
        search as string,
        hostelId
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: students,
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

  //SECTION Controller method to handle assign hostel indivisually
  async assignHostelIndivisually(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;

      if (!mongoose.isValidObjectId(createdById)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(createdById);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const {
        hostelId,
        studentId,
        bedType,
        roomNumber,
        bedNumber,
        billingCycle,
      } = req.body;

      if (!mongoose.isValidObjectId(hostelId)) throw new Error(INVALID_ID);

      if (
        !hostelId ||
        !bedType ||
        !roomNumber ||
        !bedNumber ||
        !billingCycle ||
        !studentId
      ) {
        const missingField = !hostelId
          ? "Hostel ID"
          : !bedType
          ? "Bed Type"
          : !roomNumber
          ? "RoomNumber"
          : !bedNumber
          ? "BedNumber"
          : !studentId
          ? "Student Id"
          : "Billing Cycle";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      if (
        !mongoose.isValidObjectId(hostelId) ||
        !mongoose.isValidObjectId(studentId)
      )
        throw new Error(INVALID_ID);

      // Call the service to create a new user
      await assignHostelIndivisualUser(
        hostelId,
        studentId,
        bedType,
        roomNumber,
        bedNumber,
        billingCycle,
        staff._id
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

  //SECTION Controller method to update student by id in for app
  async updateStudentDetailsForApp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const studentId = req.body._valid._id;
      const { email, image } = req.body;

      if (!mongoose.isValidObjectId(studentId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to update student
      await updateStudentInApp(studentId, email, image);

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

  //SECTION Controller method to get student by id for app
  async retrieveStudentDetailsByIdForApp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const studentId = req.body._valid._id;

      if (!mongoose.isValidObjectId(studentId)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve student
      const { response } = await fetchStudentInfoById(studentId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: response,
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

  //SECTION Controller method to update student by id in for app
  async updateStudentVechicleDetailsForApp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const studentId = req.body._valid._id;

      if (!mongoose.isValidObjectId(studentId)) {
        throw new Error(INVALID_ID);
      }
      const { vechicleDetails } = req.body;

      if (vechicleDetails) {
        for (const data of vechicleDetails) {
          const { vechicleType, modelName } = data;

          if (!vechicleType || !modelName) {
            const missingField = !vechicleType ? "Vechicle Type" : "Model Name";

            const errorResponse: HttpResponse = {
              statusCode: 400,
              message: `${missingField} is required`,
            };
            return res.status(400).json(errorResponse);
          }
        }
      }

      // Call the service to update student vechicleDetails
      await modifyVehicleInApp(studentId, vechicleDetails);

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

  //SECTION Controller method to get student by uniqueId
  async getStudentDetailsByUniqueId(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { uniqueId } = req.body;
      // Call the service to retrieve student by uniqueId
      const { student } = await getStudentByUniqueId(uniqueId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: student,
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

  //SECTION Controller method to upload kyc document in app
  async uploadKycDocuments(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const file = req.file;

      const { type, studentId } = req.body;

      const userId = studentId ? studentId : staffId;

      //NOTE - get user details
      const { student } = await getStudentById(userId);
      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      const { fileType, url } = await uploadDocument(
        student,
        type,
        file,
        staffId
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FILE_UPLOADED,
        data: {
          [fileType]: url,
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

  //SECTION Controller method to upload kyc document in app
  async uploadKycDocumentsInWardenPanel(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      //NOTE - get staff details
      const { staff } = await getStaffById(staffId);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const file = req.file;

      const { type, studentId } = req.body;

      //NOTE - get user details
      const { student } = await getStudentById(studentId);
      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      await uploadDocument(student, type, file, staffId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FILE_UPLOADED,
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

  //SECTION Controller method to get student details for admin and warden panel
  async fetchStudentDetailsByIdAndType(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) {
        throw new Error(INVALID_ID);
      }

      const { studentId, type } = req.body;

      // Call the service to retrieve student
      const { details } = await studentDetailsByType(studentId, type);

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

  //SECTION Controller method to update student as Authorized
  async updateAuthorizedUser(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { studentId, isAuthorized, authorizRole } = req.body;

      // Call the service to update student
      await updateAuthorizedUser(
        studentId,
        isAuthorized,
        authorizRole,
        staffId
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

  //SECTION Controller method to handle user creation from warden panel
  async registerUserFromWardenPanel(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));
      const {
        name,
        image,
        phone,
        email,
        dob,
        enrollmentNumber,
        bloodGroup,
        divyang,
        gender,
        identificationMark,
        medicalIssue,
        allergyProblem,
        country,
        state,
        city,
        category,
        cast,
        permanentAddress,
        currentAddress,
        familiyDetails,
        academicDetails,
        documents,
        hostelId,
        bedType,
        buildingNumber,
        floorNumber,
        roomNumber,
        bedNumber,
        billingCycle,
        vechicleDetails,
      } = req.body;

      const requiredFields: Record<string, any> = {
        Name: name,
        Email: email,
        Phone: phone,
        "Enrollment Number": enrollmentNumber,
        "Date of Birth": dob,
        "Blood Group": bloodGroup,
        Gender: gender,
        Country: country,
        State: state,
        City: city,
        Category: category,
        "Hostel ID": hostelId,
        "Bed Type": bedType,
        "Building Number": buildingNumber,
        "Floor Number": floorNumber,
        "Room Number": roomNumber,
        "Bed Number": bedNumber,
        "Billing Cycle": billingCycle,
      };

      // Find the first missing field
      const missingField = Object.keys(requiredFields).find(
        (field) => !requiredFields[field]
      );

      if (missingField) {
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new user
      const { uniqueId } = await createUserFromWardenPanel(
        name,
        phone,
        email,
        dob,
        enrollmentNumber,
        bloodGroup,
        divyang,
        gender,
        identificationMark,
        medicalIssue,
        allergyProblem,
        country,
        state,
        city,
        category,
        cast,
        permanentAddress,
        currentAddress,
        familiyDetails,
        academicDetails,
        documents,
        hostelId,
        bedType,
        buildingNumber,
        floorNumber,
        roomNumber,
        bedNumber,
        billingCycle,
        vechicleDetails,
        staffId,
        image
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: CREATE_DATA,
        data: uniqueId,
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

  //SECTION Controller method to update student  indisciplinary action
  async indisciplinaryActionUpdate(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { studentId, remark, isFine, fineAmount } = req.body;

      // Call the service to update Indisciplinary
      await studentIndisciplinaryAction(
        studentId,
        remark,
        isFine,
        fineAmount,
        staffId
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

  //SECTION Controller method to handle user bulk upload
  async userBulkUpload(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      const { universityId } = req.body;

      if (
        !mongoose.isValidObjectId(staffId) ||
        !mongoose.isValidObjectId(hostelId) ||
        !mongoose.isValidObjectId(universityId)
      )
        throw new Error(INVALID_ID);

      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const file = req.file;

      if (!file) throw new Error(REQUIRED_FIELD("File"));

      // Respond immediately that the file is being processed
      res.status(200).send({
        statusCode: 200,
        message: FILE_ON_PROCESS,
      });

      const fileUrl = await uploadFileToCloudStorage(
        file,
        USER_BULK_UPLOAD_FILES
      );
      const url = fileUrl && fileUrl.Key ? fileUrl?.Key : null;

      // Perform file processing after sending response
      const jsonData = await excelToJson(file.buffer);

      // Call the function to handle bulk upload of the data
      await userBulkUpload(jsonData, staffId, hostelId, universityId, url);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };

      // Return error response in case of failure
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to delete user vehicle details
  async deleteUserVehicleDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;

      if (!mongoose.isValidObjectId(userId)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { student } = await getStudentById(userId);

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      const { id } = req.params;

      // Call the service to delete user vehicle details
      await deleteVehicle(id, userId);

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

  //SECTION Controller method to handle user updatation from warden panel
  async updateUserFromWardenPanel(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId) || !mongoose.isValidObjectId(id))
        throw new Error(INVALID_ID);

      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const {
        name,
        image,
        phone,
        email,
        dob,
        enrollmentNumber,
        bloodGroup,
        divyang,
        gender,
        identificationMark,
        medicalIssue,
        allergyProblem,
        country,
        state,
        city,
        category,
        cast,
        permanentAddress,
        currentAddress,
        familiyDetails,
        academicDetails,
        documents,
        vechicleDetails,
      } = req.body;

      // Call the service to update a user
      await updateUserFromWardenPanel(
        id,
        name,
        phone,
        email,
        dob,
        enrollmentNumber,
        bloodGroup,
        divyang,
        gender,
        identificationMark,
        medicalIssue,
        allergyProblem,
        country,
        state,
        city,
        category,
        cast,
        permanentAddress,
        currentAddress,
        familiyDetails,
        academicDetails,
        documents,
        vechicleDetails,
        staffId,
        image
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

  //SECTION Controller method to fetch user details based on the hostel and academic details
  async fetchUsersBasedOnHostelAndAcademic(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const hostelId = req.body._valid?.hostelId;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { academicYear, universityId, floorNumber, courseId } = req.body;

      // Call the service to users Based On Hostel And Academic details
      const { users } = await usersBasedOnHostelAndAcademic(
        academicYear,
        hostelId,
        universityId,
        floorNumber,
        courseId
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

  //SECTION: Controller Method to update user status.
  async updateUserStatus(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid?._id;
      const { studentId, status } = req.body;

      if (!mongoose.isValidObjectId(staffId) || !mongoose.isValidObjectId(studentId))
        throw new Error(INVALID_ID);

      const { staff } = await getStaffById(staffId);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      await updateUserStatus(studentId, status, staffId);
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

export default new UserController();
