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
import Joi from "joi";
import moment from "moment";

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
  deleteStudent,
  userRequestDelete,
  verifyOTP
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


const normalizeFullName = (name: string) => {
  if (typeof name !== "string") return name;

  return name
    .trim()                     // Remove leading & trailing spaces
    .replace(/[^a-zA-Z\s]/g, "") // Remove special characters & numbers
    .replace(/\s+/g, " ");      // Replace multiple spaces with one
};

// const excelDateToJSDate = (input: number) => {
//   let date;
//   // If it's Excel serial date (number like 45937.000...)
//   if (typeof input === "number") {
//     const utc_days = Math.floor(input - 25569);
//     const utc_value = utc_days * 86400;
//     date = new Date(utc_value * 1000);
//   } else {
//     // If it's a date string like "10/05/2025" or "2025-05-10"
//     date = new Date(input);
//   }

//   // Format to DD/MM/YYYY
//   const day = String(date.getDate()).padStart(2, "0");
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const year = date.getFullYear();

//   return `${year}-${month}-${day}`;
// }
// const excelDateToJSDate = (input: number | string): string => {
//   let date: Date;

//   if (typeof input === "number") {
//     // 📘 Excel serial date (days since 1899-12-30)
//     const utc_days = Math.floor(input - 25569);
//     const utc_value = utc_days * 86400; // seconds
//     date = new Date(utc_value * 1000); // milliseconds
//   } else if (typeof input === "string" && input.includes("/")) {
//     // 📘 Date string in format "DD/MM/YYYY"
//     const [day, month, year] = input.split("/").map(Number);

//     if (!day || !month || !year) {
//       throw new Error("Invalid date string format. Expected DD/MM/YYYY.");
//     }

//     date = new Date(year, month - 1, day); // month is 0-based
//   } else {
//     // 📘 ISO or other standard formats
//     date = new Date(input);

//     if (isNaN(date.getTime())) {
//       throw new Error("Invalid date input.");
//     }
//   }

//   const day = String(date.getDate()).padStart(2, "0");
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const year = date.getFullYear();

//   return `${year}-${month}-${day}`;
// };
const excelDateToJSDate = (input: number | string): { success: boolean; date?: string | number; error?: string } => {
  let momentDate: moment.Moment;

  try {
    if (typeof input === "number") {
      if (input >= 1000 && input <= 9999) {
        return { success: false, error: "Invalid DOB: year only is not allowed.", date: input };
      }

      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const msPerDay = 24 * 60 * 60 * 1000;
      const date = new Date(excelEpoch.getTime() + input * msPerDay);
      momentDate = moment(date);
    } else if (typeof input === "string") {

      momentDate = moment(
        input,
        [
          "YYYY-MM-DD",
          "DD-MM-YYYY",
          "DD/MM/YYYY",
          "MM/DD/YYYY",
          "D-M-YYYY",
          "D/M/YYYY",
          // moment.ISO_8601,
        ],
        true
      );
      if (!momentDate.isValid()) {
        return { success: false, error: "Invalid DOB format.", date: input };
      }
    } else {
      return { success: false, error: "Unsupported DOB format.", date: input };
    }
    if (!momentDate.isValid()) {
      return { success: false, error: "Invalid DOB format.", date: input };
    }

    return { success: true, date: momentDate.format("YYYY-MM-DD") };
  } catch {
    return { success: false, error: "DOB parsing error.", date: input };
  }
};




// const excelDateToJSDate = (input: number | string): string => {
//   let momentDate: moment.Moment;

//   if (typeof input === "number") {
//     // If the number is less than 10000, assume it's a year only
//     if (input < 10000) {
//       // Convert year-only into a date e.g. "2002-01-01"
//       momentDate = moment(`${input}`, "YYYY", true);
//       if (!momentDate.isValid()) throw new Error("Invalid year format");
//     } else {
//       // Excel serial number → JS Date
//       const excelEpoch = new Date(Date.UTC(1899, 11, 30));
//       const msPerDay = 24 * 60 * 60 * 1000;
//       const date = new Date(excelEpoch.getTime() + input * msPerDay);
//       momentDate = moment(date);
//     }
//   } 
//   else if (typeof input === "string") {
//     momentDate = moment(
//       input,
//       [
//         "YYYY-MM-DD",
//         "DD-MM-YYYY",
//         "DD/MM/YYYY",
//         "MM/DD/YYYY",
//         "D-M-YYYY",
//         "D/M/YYYY",
//         moment.ISO_8601,
//       ],
//       true
//     );
//   } 
//   else {
//     throw new Error("Unsupported input type for DOB.");
//   }

//   if (!momentDate.isValid()){
//     console.log("error dob")
//     throw new Error("Invalid DOB format");
//   } 

//   return momentDate.format("YYYY-MM-DD");
// };



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
      const allowedDomains = [
        "gmail.com",
        "yahoo.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "icloud.com",
        "aol.com",
        "zoho.com"
      ];

      let payload
      let studentId = req?.body?._valid?._id

      payload = {
        ...req.body,
        phone: String(req?.body?.phone),
        motherName: normalizeFullName(req?.body?.motherName),
        fatherName: normalizeFullName(req?.body?.fatherName),
        fatherPhone: String(req?.body?.fatherPhone),
        motherPhone: String(req?.body?.motherPhone),
        aadhar: String(req?.body?.aadhar),
        name: normalizeFullName(req?.body?.studentName),
        gender: req.body?.gender?.replace(/\s+/g, "").toLowerCase(),
        dob: excelDateToJSDate(req?.body?.dob)?.success === true ? excelDateToJSDate(req?.body?.dob)?.date : excelDateToJSDate(req?.body?.dob),
      }

      delete payload._valid
      delete payload.studentName

      const schema = Joi.object({
        name: Joi.string().required().messages({
          "any.required": "Student Name is required",
        }),
        gender: Joi.string().required(),
        divyang: Joi.boolean().allow(null),
        enroll: Joi.string().allow('', null),
        identification: Joi.string().allow('', null),
        medical: Joi.string().allow('', null),
        allergyProblem: Joi.string().allow('', null),
        category: Joi.string().allow('', null),
        cast: Joi.string().allow('', null),
        email: Joi.string()
          .email({ tlds: { allow: false } })
          .custom((value, helpers) => {
            const domain = value.split("@")[1];

            if (!allowedDomains.includes(domain)) {
              return helpers.error("any.invalid");
            }
            return value;
          })
          .required()
          .messages({
            "string.email": "Invalid email format",
            "any.invalid": `Only these domains allowed: ${allowedDomains.join(", ")}`,
            "any.required": "Email is required"
          }),
        dob: Joi.date()
          .required()
          .messages({
            "any.required": "Date of Birth is required",
            "date.base": "Invalid Date format for Date of Birth",
          }),
        phone: Joi.string()
          .trim()
          .custom((value, helpers) => {
            if (!/^\d+$/.test(value)) {
              return helpers.error("any.invalid");
            }
            if (value.length < 8 || value.length > 15) {
              return helpers.error("number.length");
            }
            return value;
          })
          .required()
          .messages({
            "any.invalid": "Mobile Number must contain digits only",
            "number.length": "Mobile Number must be between 8 to 15 digits",
            "any.required": "Mobile Number is required",
          }),
        aadhar: Joi.string().allow(" ", null),
        address: Joi.string().allow(" ", null),
        country: Joi.string().required().messages({
          "any.required": "Country is required",
        }),
        state: Joi.string().required().messages({
          "any.required": "State is required",
        }),
        city: Joi.string().required().messages({
          "any.required": "City is required",
        }),
        bloodGroup: Joi.string().required(),
        fatherName: Joi.string().max(70).required().messages({
          "any.required": "Father's Name is required",
          "string.base": "Father's Name must be a string",
        }),
        fatherPhone: Joi.string()
          .trim()
          .custom((value, helpers) => {
            if (!/^\d+$/.test(value)) {
              return helpers.error("any.invalid");
            }
            if (value.length < 8 || value.length > 15) {
              return helpers.error("number.length");
            }
            return value;
          })
          .required()
          .messages({
            "any.invalid": "Father's Mobile Number must contain digits only",
            "number.length": "Father's Mobile Number must be between 8 to 15 digits",
            "any.required": "Father's Mobile Number is required",
          }),
        motherName: Joi.string().max(70).required().messages({
          "any.required": "Mother's Name is required",
          "string.base": "Mother's Name must be a string",
        }),
        motherPhone: Joi.string()
          .trim()
          .custom((value, helpers) => {
            if (!/^\d+$/.test(value)) {
              return helpers.error("any.invalid");
            }
            if (value.length < 8 || value.length > 15) {
              return helpers.error("number.length");
            }
            return value;
          })
          .required()
          .messages({
            "any.invalid": "Mother's Mobile Number must contain digits only",
            "number.length": "Mother's Mobile Number must be between 8 to 15 digits",
            "any.required": "Mother's Mobile Number is required",
          }),
        guardianName: Joi.string().max(70).optional().allow('', null),
        guardianRelation: Joi.string().max(100).optional().allow('', null),
        occuption: Joi.string().max(70).optional().allow('', null),
        guardianAddress: Joi.string().optional().allow('', null),
        image: Joi.string().required().allow('', null)
      });

      const { error } = schema.validate(payload, {
        abortEarly: false,   // collect all errors
      });
      if (error) {
        return res.status(400).json({
          statusCode: 400,
          message: error?.details
        })

      }
      if (!mongoose.isValidObjectId(studentId)) {
        throw new Error(INVALID_ID);
      }


      let studentData: any

      let familiyDetails = {
        motherName: normalizeFullName(payload?.motherName),
        fatherName: normalizeFullName(payload?.fatherName),
        fatherNumber: String(payload?.fatherPhone),
        motherNumber: String(payload?.motherPhone),
        guardianName: String(payload?.guardianName),
        relationship: String(payload?.guardianRelation),
        address: String(payload?.guardianAddress)
      }
      studentData = {
        ...payload,
        bulkCity: payload?.city,
        bulkCountry: payload?.country,
        bulkState: payload?.state,
        familiyDetails: familiyDetails,
        image: payload?.image,
      };

      delete studentData.city;
      delete studentData.country;
      delete studentData.state;
      delete studentData.fatherName;
      delete studentData.motherName;
      delete studentData.fatherPhone;
      delete studentData.motherPhone;
      delete studentData.guardianName;
      delete studentData.guardianRelation;
      delete studentData.guardianAddress;

      // Call the service to update student
      await updateStudentInApp(studentId, studentData);

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

    const familyDetailsSchema = Joi.object({
      fatherName: Joi.string().required().messages({
        'string.base': 'Father name must be a string',
        'string.empty': 'Father name is required',
      }),
      // fatherNumber: Joi.number().min(1000000000).required().messages({
      //   'number.base': 'Father number must be a number',
      //   'number.min': 'Father number must be at least 10 digits',
      //   'any.required': 'Father number is required',
      // }),
      // fatherEmail: Joi.string().email({ tlds: { allow: false } }).allow('', null).messages({
      //   'string.email': 'Father email must be a valid email address',
      // }),
      fatherOccuption: Joi.string().allow('', null).messages({
        'string.base': 'Father occupation must be a string',
      }),

      motherName: Joi.string().required().messages({
        'string.empty': 'Mother name is required',
      }),
      // motherNumber: Joi.number().min(1000000000).required().messages({
      //   'number.min': 'Mother number must be at least 10 digits',
      //   'any.required': 'Mother number is required',
      // }),
      // motherEmail: Joi.string().email({ tlds: { allow: false } }).allow('', null).messages({
      //   'string.email': 'Mother email must be valid',
      // }),

      guardianName: Joi.string().allow('', null),
      guardianContactNo: Joi.number().min(1000000000).allow(null).messages({
        'number.min': 'Guardian contact must be at least 10 digits',
      }),
      relationship: Joi.string().allow('', null),
      occuption: Joi.string().allow('', null),
      guardianEmail: Joi.string().email({ tlds: { allow: false } }).allow('', null).messages({
        'string.email': 'Guardian email must be valid',
      }),
      address: Joi.string().allow('', null),
    });
    const vehicleDetails = Joi.array()
      .items(
        Joi.object({
          engineType: Joi.string()
            .valid("fuel", "electric", "hybrid") // you can add more options
            .required()
            .messages({
              "any.required": "Engine type is required",
              "any.only": "Engine type must be one of: fuel, electric, hybrid",
            }),

          modelName: Joi.string().required().messages({
            "any.required": "Model name is required",
          }),

          vehicleNumber: Joi.string()
            .pattern(/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/i) // e.g. MH49S6439
            .required()
            .messages({
              "string.pattern.base": "Vehicle number must be in valid format (e.g. MH49S6439)",
              "any.required": "Vehicle number is required",
            }),

          vehicleType: Joi.string()
            .valid("car", "bike", "bus", "truck", "other")
            .required()
            .messages({
              "any.required": "Vehicle type is required",
              "any.only": "Vehicle type must be car, bike, bus, truck, or other",
            }),
        })
      )
      .optional()
      .allow(null)
      .default([])
      .messages({
        "array.base": "Vehicle details must be an array",
      })

    const schema = Joi.object({
      name: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required(),
      // image: '',
      phone: Joi.number().integer().min(1000000000).max(9999999999).required().messages({
        "string.pattern.base": "Mobile Number must be exactly 10 digits",
        "any.required": "Mobile Number is required",
        "number.min": "Mobile Number must be exactly 10 digits",
        "number.max": "Mobile Number must be exactly 10 digits",
      }),
      email: Joi.string()
        .email().optional().allow(null),
      dob: Joi.date().iso().less('now').required().messages({
        'date.base': 'DOB must be a valid date',
        'date.less': 'DOB must be in the past',
        'any.required': 'DOB is required',
      }),
      enrollmentNumber: Joi.string().optional().allow(null),
      bloodGroup: Joi.string().optional().allow(null),
      gender: Joi.string()
        .valid("male", "female", "other")
        .required()
        .messages({
          "any.only": "Gender must be 'male', 'female', or 'other'",
          "any.required": "Gender is required",
        }),
      divyang: Joi.boolean().optional().allow(null),
      identificationMark: Joi.string().optional().allow(null),
      medicalIssue: Joi.string().optional().allow(null),
      allergyProblem: Joi.string().optional().allow(null),
      // country: { name: 'India', iso2: 'IN', countryId: 101 },
      country: Joi.object().required(),
      state: Joi.object().required(),
      city: Joi.object().required(),
      cast: Joi.object().required(),
      permanentAddress: Joi.string().required().messages({
        'string.base': 'Permanent address must be a text',
        'string.empty': 'Permanent address is required',
        'any.required': 'Permanent address is required',
      }),
      familiyDetails: familyDetailsSchema.required(),
      academicDetails: { academicYear: null },
      vechicleDetails: vehicleDetails,
      buildingNumber: Joi.number().optional().allow(null),
      roomNumber: Joi.number().optional().allow(null),
    })
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      console.log(error, "error")
      // error.details.forEach((err: any) => {
      //   const field = err.context.label || err.context.key;
      //   const message = err.message.replace(/"/g, "");
      //   errors.push(`${field}: ${message}`);
      // });
    }
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

      // const requiredFields: Record<string, any> = {
      //   Name: name,
      //   Email: email,
      //   Phone: phone,
      //   "Enrollment Number": enrollmentNumber,
      //   "Date of Birth": dob,
      //   "Blood Group": bloodGroup,
      //   Gender: gender,
      //   Country: country,
      //   State: state,
      //   City: city,
      //   Category: category,
      //   "Hostel ID": hostelId,
      //   "Bed Type": bedType,
      //   "Building Number": buildingNumber,
      //   "Floor Number": floorNumber,
      //   "Room Number": roomNumber,
      //   "Bed Number": bedNumber,
      //   "Billing Cycle": billingCycle,
      // };

      // // Find the first missing field
      // const missingField = Object.keys(requiredFields).find(
      //   (field) => !requiredFields[field]
      // );

      // if (missingField) {
      //   const errorResponse: HttpResponse = {
      //     statusCode: 400,
      //     message: `${missingField} is required`,
      //   };
      //   return res.status(400).json(errorResponse);
      // }

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
      const data = jsonData.map((item: any) => {

        return {
          ...item,
          Email: item?.Email,
          "Full Name of Student": normalizeFullName(item["Full Name of Student"]),
          "Father's Name": normalizeFullName(item["Father's Name"]),
          "Mother's Name": normalizeFullName(item["Mother's Name"]),
          "Date of Birth": excelDateToJSDate(item["Date of Birth"])?.success === true ? excelDateToJSDate(item["Date of Birth"])?.date : excelDateToJSDate(item["Date of Birth"]),
          "Permanent Address": String(item["Permanent Address"]),
          "Aadhaar Number": Number(item["Aadhaar Number"]),
          "Blood Group": String(item["Blood Group"])
            .replace(/\s+/g, "") // remove all spaces inside string
            .toUpperCase(), // optional normalize case => B+
          "Mobile No.": String(item["Mobile No."]),
          Gender: String(item?.Gender).trim().toLowerCase()
        }
      })

      data.forEach((item: any) => {
        delete item.Timestamp,
          item["Aadhaar Number"] = item["Aadhaar Number"] ? item["Aadhaar Number"] : ""
      });
      await userBulkUpload(data, staffId, hostelId, universityId, url);
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
        // currentAddress,
        aadharNumber,
        familiyDetails,
        academicDetails,
        documents,
        vechicleDetails,
        floorNumber,
        roomNumber,
        bedNumber,
        hostelId
      } = req.body;
      console.log(image, "imagessssssssssssssssssss2222222")

      const allowedDomains = [
        "gmail.com",
        "yahoo.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "icloud.com",
        "aol.com",
        "zoho.com"
      ];
      let data = {
        ...req?.body,
      }
      delete data._valid

      const vechicleDetailsSchema = Joi.object({
        vechicleType: Joi.string()
          .valid("bicycle", "bike", "car")
          .required()
          .messages({
            "any.only": "Vehicle type must be one of 'bicycle', 'bike', or 'car'",
            "any.required": "Vehicle type is required",
          }),

        engineType: Joi.string()
          .required()
          .messages({
            "string.base": "Engine type must be a string",
            "any.required": "Engine type is required",
          }),

        vechicleNumber: Joi.string()
          .allow("", null)
          .messages({
            "string.base": "Vehicle number must be a string",
          }),
        modelName: Joi.string()
          .required()
          .messages({
            "string.base": "Model name must be a string",
            "any.required": "Model name is required",
          }),
      });
      const documentsSchema = {
        aadharNumber: Joi.string()
          .allow("", null)
          .when(Joi.string().min(1), {
            then: Joi.string()
              .pattern(/^\d{12}$/)
              .messages({
                "string.pattern.base": "Aadhaar Number must be exactly 12 digits",
              }),
          }),
        aadhaarCard: Joi.string().uri().optional().messages({
          "string.uri": "Aadhaar Card must be a valid URL",
        }).allow('', null),
        voterCard: Joi.string().uri().optional().messages({
          "string.uri": "Voter Card must be a valid URL",
        }).allow('', null),
        passport: Joi.string().uri().optional().messages({
          "string.uri": "Passport must be a valid URL",
        }).allow('', null),
        drivingLicense: Joi.string().uri().optional().messages({
          "string.uri": "Driving License must be a valid URL",
        }).allow('', null),
        panCard: Joi.string().uri().optional().messages({
          "string.uri": "PAN Card must be a valid URL",
        }).allow('', null),
      };

      const academicDetailsSchema = {
        universityId: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .messages({
            "string.pattern.base": "University ID must be a valid ObjectId",
            "any.required": "University ID is required",
          }).allow('', null),

        courseId: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .messages({
            "string.pattern.base": "Course ID must be a valid ObjectId",
            "any.required": "Course ID is required",
          }).allow('', null),

        academicYear: Joi.string()
          .messages({
            "any.required": "Academic Year is required",
          }).allow('', null),

        semester: Joi.number()
          .valid(1, 2, 3, 4, 5, 6, 7, 8)
          .allow("", null)
          .messages({
            "any.only": "Semester must be one of 1, 2, 3, 4, 5, 6, 7, or 8",
            "number.base": "Semester must be a number",
          })
      };

      const familyDetailsSchema = {
        fatherName: Joi.string().max(70).required().messages({
          "any.required": "Father's Name is required",
          "string.base": "Father's Name must be a string",
        }),
        fatherNumber: Joi.string()
          .trim()
          .custom((value, helpers) => {
            if (!/^\d+$/.test(value)) {
              return helpers.error("any.invalid");
            }
            if (value.length < 8 || value.length > 15) {
              return helpers.error("number.length");
            }
            return value;
          })
          .required()
          .messages({
            "any.invalid": "Father's Mobile Number must contain digits only",
            "number.length": "Father's Mobile Number must be between 8 to 15 digits",
            "any.required": "Father's Mobile Number is required",
          }),
        motherName: Joi.string().max(70).required().messages({
          "any.required": "Mother's Name is required",
          "string.base": "Mother's Name must be a string",
        }),
        motherNumber: Joi.string()
          .trim()
          .custom((value, helpers) => {
            if (!/^\d+$/.test(value)) {
              return helpers.error("any.invalid");
            }
            if (value.length < 8 || value.length > 15) {
              return helpers.error("number.length");
            }
            return value;
          })
          .required()
          .messages({
            "any.invalid": "Mother's Mobile Number must contain digits only",
            "number.length": "Mother's Mobile Number must be between 8 to 15 digits",
            "any.required": "Mother's Mobile Number is required",
          }),
        guardianName: Joi.string().max(70).optional().allow('', null),
        relationship: Joi.string().max(100).optional().allow('', null),
        occuption: Joi.string().max(70).optional().allow('', null),
        address: Joi.string().optional().allow('', null),
      };
      const schema = Joi.object({
        image: Joi.any().allow("", null),
        hostelId: Joi.string().required().allow('', null),
        name: Joi.string().required().messages({
          "any.required": "Student Name is required",
        }),
        buildingNumber: Joi.string().required().allow('', null),
        gender: Joi.string().required(),
        divyang: Joi.boolean().allow(null),
        enrollmentNumber: Joi.string().allow('', null),
        identificationMark: Joi.string().allow('', null),
        medicalIssue: Joi.string().allow('', null),
        allergyProblem: Joi.string().allow('', null),
        category: Joi.string().allow('', null),
        cast: Joi.string().allow('', null),
        email: Joi.string()
          .email({ tlds: { allow: false } })
          .custom((value, helpers) => {
            const domain = value.split("@")[1];

            if (!allowedDomains.includes(domain)) {
              return helpers.error("any.invalid");
            }
            return value;
          })
          .required()
          .messages({
            "string.email": "Invalid email format",
            "any.invalid": `Only these domains allowed: ${allowedDomains.join(", ")}`,
            "any.required": "Email is required"
          }),
        dob: Joi.date()
          .required()
          .messages({
            "any.required": "Date of Birth is required",
            "date.base": "Invalid Date format for Date of Birth",
          }),
        phone: Joi.string()
          .trim()
          .custom((value, helpers) => {
            if (!/^\d+$/.test(value)) {
              return helpers.error("any.invalid");
            }
            if (value.length < 8 || value.length > 15) {
              return helpers.error("number.length");
            }
            return value;
          })
          .required()
          .messages({
            "any.invalid": "Mobile Number must contain digits only",
            "number.length": "Mobile Number must be between 8 to 15 digits",
            "any.required": "Mobile Number is required",
          }),
        permanentAddress: Joi.string().required(),
        country: Joi.object({
          name: Joi.string().required().messages({
            "string.base": "Country name must be a string",
            "any.required": "Country name is required",
          }),

          iso2: Joi.string()
            .length(2)
            .uppercase()
            .required()
            .messages({
              "string.length": "ISO2 code must be exactly 2 characters",
              "string.base": "ISO2 code must be a string",
              "any.required": "ISO2 code is required",
            }),

          countryId: Joi.number().integer().required().messages({
            "number.base": "Country ID must be a number",
            "any.required": "Country ID is required",
          }),
        })
          .required()
          .messages({
            "object.base": "Country must be an object",
            "any.required": "Country is required",
          }),
        state: Joi.object({
          stateId: Joi.number()
            .integer()
            .required()
            .messages({
              "number.base": "State ID must be a number",
              "any.required": "State ID is required",
            }),

          name: Joi.string()
            .required()
            .messages({
              "string.base": "State name must be a string",
              "any.required": "State name is required",
            }),

          iso2: Joi.string()
            .length(2)
            .uppercase()
            .required()
            .messages({
              "string.length": "State ISO2 code must be exactly 2 uppercase letters",
              "string.base": "State ISO2 code must be a string",
              "any.required": "State ISO2 code is required",
            }),
        })
          .required()
          .messages({
            "object.base": "State must be an object",
            "any.required": "State is  required",
          }),
        city: Joi.object({
          cityId: Joi.number()
            .integer()
            .required()
            .messages({
              "number.base": "City ID must be a number",
              "any.required": "City ID is required",
            }),

          name: Joi.string()
            .required()
            .messages({
              "string.base": "City name must be a string",
              "any.required": "City name is required",
            }),
        })
          .required()
          .messages({
            "object.base": "City must be an object",
            "any.required": "City is required",
          }),
        roomNumber: Joi.number().integer().required(),
        floorNumber: Joi.number().integer().required(),
        bedNumber: Joi.string().required(),
        bloodGroup: Joi.string().required(),
        vechicleDetails: Joi.array()
          .items(vechicleDetailsSchema)
          .optional()
          .messages({
            "array.base": "Vehicle details must be an array",
          }),
        documents: Joi.object(documentsSchema).required(),
        academicDetails: Joi.object(academicDetailsSchema).optional(),
        familiyDetails: Joi.object(familyDetailsSchema).required()
      });

      const { error } = schema.validate(data, {
        abortEarly: false,   // collect all errors
      });


      if (error) {
        return res.status(400).json({
          statusCode: 400,
          message: error?.details.map((item: any) => item?.message)
        });
      }

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
        // currentAddress,
        familiyDetails,
        academicDetails,
        documents,
        vechicleDetails,
        staffId,
        image,
        floorNumber,
        roomNumber,
        bedNumber,
        aadharNumber,
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

  async updateUserFromApp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const allowedDomains = [
        "gmail.com",
        "yahoo.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "icloud.com",
        "aol.com",
        "zoho.com"
      ];
      const schema = Joi.object({
        Gender: Joi.string().required().messages({
          "any.required": "Gender is required",
        }),
        email: Joi.string()
          .email({ tlds: { allow: false } })
          .custom((value, helpers) => {
            const domain = value.split("@")[1];

            if (!allowedDomains.includes(domain)) {
              return helpers.error("any.invalid");
            }
            return value;
          })
          .required()
          .messages({
            "string.email": "Invalid email format",
            "any.invalid": `Only these domains allowed: ${allowedDomains.join(", ")}`,
            "any.required": "Email is required"
          }),
        dob: Joi.date()
          .required()
          .messages({
            "any.required": "Date of Birth is required",
            "date.base": "Invalid Date format for Date of Birth",
          }),
        studentName: Joi.string()
          .max(70)
          .required()
          .messages({
            "string.max": "Full Name must not exceed 70 characters",
            "any.required": "Full Name is required",
          }),
        "Mobile Number of Student": Joi.string()
          .trim()
          .custom((value, helpers) => {
            if (!/^\d+$/.test(value)) {
              return helpers.error("any.invalid");
            }
            if (value.length < 8 || value.length > 15) {
              return helpers.error("number.length");
            }
            return value;
          })
          .required()
          .messages({
            "any.invalid": "Mobile Number must contain digits only",
            "number.length": "Mobile Number must be between 8 to 15 digits",
            "any.required": "Mobile Number is required",
          }),
        fatherName: Joi.string()
          .max(70)
          .required()
          .messages({
            "string.max": "Full Name must not exceed 70 characters",
            "any.required": "Full Name is required",
          }),
        motherName: Joi.string()
          .max(70)
          .required()
          .messages({
            "string.max": "Full Name must not exceed 70 characters",
            "any.required": "Full Name is required",
          }),
        permanentAddress: Joi.string().required(),
        "Hostel Name": Joi.string().required(),
        "Aadhaar Number": Joi.number().allow("", null) // allow empty
          .integer()
          .required()
          .custom((value, helpers) => {
            const str = String(value);

            // Must be only digits
            if (!/^\d+$/.test(str)) {
              return helpers.error("any.invalid");
            }

            // Check length 8 to 18 digits
            if (str.length !== 12) {
              return helpers.error("number.length");
            }

            return value;
          })
          .messages({
            "any.invalid": "Aadhaar Number must contain digits only",
            "number.length": "Aadhaar Number must be exactly 12 digits",
            // "any.required": "Aadhaar Number is required",
            "number.base": "Aadhaar Number must be a number",
          }),
        "Country": Joi.string().required(),
        "State": Joi.string().required(),
        "City": Joi.string().required(),
        "Mother's Mobile Number": Joi.number()
          .integer()
          .required()
          .custom((value, helpers) => {
            const str = String(value);

            // Must be only digits
            if (!/^\d+$/.test(str)) {
              return helpers.error("any.invalid");
            }

            // Check length 8 to 18 digits
            if (str.length < 8 || str.length > 15) {
              return helpers.error("number.length");
            }

            return value;
          })
          .messages({
            "any.invalid": "Mother's Mobile Number must contain digits only",
            "number.length": "Mother's Mobile Number must be between 8 to 15 digits",
            "any.required": "Mother's Mobile Number is required",
            "number.base": "Mother's Mobile Number must be a number",
          }),
        "Father's Mobile Number": Joi.number()
          .integer()
          .required()
          .custom((value, helpers) => {
            const str = String(value);

            // Must be only digits
            if (!/^\d+$/.test(str)) {
              return helpers.error("any.invalid");
            }

            // Check length 8 to 18 digits
            if (str.length < 8 || str.length > 15) {
              return helpers.error("number.length");
            }

            return value;
          })
          .messages({
            "any.invalid": "Father's Mobile Number must contain digits only",
            "number.length": "Father's Mobile Number must be between 8 to 15 digits",
            "any.required": "Father's Mobile Number is required",
            "number.base": "Father's Mobile Number must be a number",
          }),
        "Room Number": Joi.number().integer().required(),
        "Floor Number": Joi.number().integer().required(),
        "Blood Group": Joi.string().required(),
        "Bed Number": Joi.string().required()
      });
      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: "",
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

  //SECTION: Controller Method to delete user status.
  async deleteUsers(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req?.params
      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }
      await deleteStudent(id)
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

  async userDeleteRequest(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {

      const schema = Joi.object({
        email: Joi.string().email().required(),
      });

      const { error, value } = schema.validate(req?.body);
      if (error) {
        const errorResponse = {
          statusCode: 400,
          message: error?.details[0]?.message,
        };
        return res.status(400).json(errorResponse);
      }
      const user = await userRequestDelete(value?.email)

      const successResponse: HttpResponse = {
        statusCode: 200,
        data: user,
        message: "OTP has been sent",
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

  async userVerifyOtp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        otp: Joi.number().required(),
      });

      const { error, value } = schema.validate(req?.body);
      if (error) {
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${error?.details[0]?.message}`,
        };
        return res.status(400).json(errorResponse);
      }
      await verifyOTP(value?.otp, value?.email)
      const successResponse: HttpResponse = {
        statusCode: 200,
        message: "OTP Verified Successfully",
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
