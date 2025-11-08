import mongoose from "mongoose";
import { Request, Response } from "express";
import HostelService from "../services/hostel.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";
import { uploadFileToCloudStorage } from "../utils/awsUploadService";
import { excelToJson } from "../utils/excelToJson";
import { HOSTEL_ROOM_MAP_BULK_UPLOAD_FILES } from "../utils/s3bucketFolder";

//NOTE - all services
const { getStaffById } = StaffService;
const {
  createNewHostel,
  getHostelWeb,
  hostelWithPagination,
  getHostelById,
  deleteHostelById,
  updateHostelById,
  roomMappingAddorUpdate,
  retrieveMapppedRoom,
  fetchHostelForUser,
  bedTypesByHostelId,
  vacantRoomsByBedType,
  getRoomsByBedType,
  uploadLegalDocuments,
  retrievedUploadLegalDocuments,
  updateMessDetails,
  fetchHostelMessDetails,
  fetchFloorByBedTypeAndHostelId,
  fetchUserDetailsOfRoom,
  fetchPaymentOptionsByHostel,
  roomsByMultipleFloorNumbers,
  uploadRoomMappingInBulk,
  fetchFloorRooms,
} = HostelService;

//NOTE - all messages
const {
  FETCH_SUCCESS,
  CREATE_DATA,
  DELETE_DATA,
  UPDATE_DATA,
  FILE_ON_PROCESS,
} = SUCCESS_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { INVALID_ID, REQUIRED_FIELD } = VALIDATION_MESSAGES;

class HostelController {
  //SECTION Controller method to handle hostel creation
  async createHostelInAdmin(
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

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const {
        universityId,
        name,
        identifier,
        buildingNumber,
        address,
        image,
        description,
        securityFee,
        amenitieIds,
        bedDetails,
        isAgreementRequired,
        visitingHours,
        emergencyNumbers,
        securityDetails,
        status,
      } = req.body;

      // Validate all keys in payload except `status`
      const payloadKeys = Object.keys(req.body);
      const requiredKeys = [
        "universityId",
        "name",
        "identifier",
        "buildingNumber",
        "address",
        "image",
        "description",
        "securityFee",
        "amenitieIds",
        "bedDetails",
        "visitingHours",
        "emergencyNumbers",
        "securityDetails",
      ];

      const missingKeys = requiredKeys.filter(
        (key) => !payloadKeys.includes(key) || !req.body[key]
      );

      if (missingKeys.length > 0) {
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `Missing required fields: ${missingKeys.join(", ")}`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new hostel
      await createNewHostel(
        universityId,
        name,
        identifier,
        buildingNumber,
        address,
        image,
        description,
        securityFee,
        amenitieIds,
        bedDetails,
        isAgreementRequired,
        visitingHours,
        emergencyNumbers,
        securityDetails,
        status,
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

  //SECTION Controller method to handle hostel get for web without token
  async getHostelwithoutToken(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      // Call the service to create a new user
      const { hostel } = await getHostelWeb();

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: hostel,
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

  //SECTION Controller method to get hostel with optional pagination and search
  async getAllHostelWithPagination(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { page, limit, search } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to retrieve all hostel
      const { hostels, count } = await hostelWithPagination(
        parsedPage,
        parsedLimit,
        search as string
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
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

  //SECTION Controller method to get hostel by id with bed details not room details
  async getHosteldetailsById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve  hostel by id
      const { hostel } = await getHostelById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: hostel,
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

  //SECTION Controller method to delete hostel by id
  async deleteHostelById(
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

      // Call the service to retrieve  hostel by id
      const { message } = await deleteHostelById(id, status, updatedById);

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

  //SECTION Controller method to update hostel by id
  async updateHostelDetailsById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      const updatedById = req.body._valid._id;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(updatedById);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const {
        universityId,
        name,
        identifier,
        buildingNumber,
        address,
        image,
        description,
        securityFee,
        amenitieIds,
        bedDetails,
        isAgreementRequired,
        visitingHours,
        emergencyNumbers,
        securityDetails,
        status,
      } = req.body;

      // Call the service to retrieve  hostel by id
      await updateHostelById(
        id,
        universityId,
        name,
        identifier,
        buildingNumber,
        address,
        image,
        description,
        securityFee,
        amenitieIds,
        bedDetails,
        isAgreementRequired,
        visitingHours,
        emergencyNumbers,
        securityDetails,
        status,
        staff._id
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

  //SECTION Controller method to add or update hostel room details by id
  async addOrUpdateRoomMappingDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const updatedById = req.body._valid._id;

      if (!mongoose.isValidObjectId(updatedById)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(updatedById);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { hostelId, roomDetails } = req.body;

      if (!hostelId || !roomDetails) {
        const missingField = !hostelId ? "Hostel Id" : "Room details";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to retrieve  hostel by id
      await roomMappingAddorUpdate(hostelId, roomDetails, staff._id);

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

  //SECTION Controller method to fetch Mappped Room Details
  async fetchMapppedRoomDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { hostelId } = req.body;

      if (!mongoose.isValidObjectId(hostelId)) {
        throw new Error(INVALID_ID);
      }

      if (!hostelId) {
        const missingField = "Hostel Id";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to retrieve room details by hostel id
      const { counts, rooms } = await retrieveMapppedRoom(hostelId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        counts,
        data: rooms,
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

  //SECTION Controller method to handle hostel get for app
  async fetchHostelDetailsForApp(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;

      // Call the service to create a new user
      const { hostel } = await fetchHostelForUser(userId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: hostel,
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

  //SECTION Controller method to handle fetch Bed Types By HostelId
  async fetchBedTypesByHostelId(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { hostelId } = req.body;

      // Call the service to get bed types
      const { bedTypes } = await bedTypesByHostelId(hostelId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: bedTypes,
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

  //SECTION Controller method to handle fetch floor by room and bed type
  async fetchFloorByBedTypeAndHostelId(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const tokenHostelId = req.body._valid.hostelId;

      const { bedType } = req.body;

      let hostelId = req.body.hostelId ?? tokenHostelId;

      if (
        !mongoose.isValidObjectId(staffId) ||
        !mongoose.isValidObjectId(hostelId)
      )
        throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Call the service to get floor details
      const { floorNumbers } = await fetchFloorByBedTypeAndHostelId(
        hostelId,
        bedType
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: floorNumbers,
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

  //SECTION Controller method to fetch room details by hostel id and bed type
  async getRoomsByBedType(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const hostelIdForToken = req.body._valid?.hostelId;
      let { bedType, floorNumber } = req.body;
      let hostelId = req.body.hostelId ?? hostelIdForToken;

      if (!mongoose.isValidObjectId(hostelId)) throw new Error(INVALID_ID);

      if (!hostelId) {
        const missingField = "Hostel Id";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to retrieve room details by hostel id
      const { rooms } = await getRoomsByBedType(hostelId, floorNumber, bedType);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: rooms,
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

  //SECTION Controller method to handle get Vacant Rooms By BedType
  async getVacantRoomsByBedType(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { hostelId, bedType, roomNumber } = req.body;

      // Call the service to get vacant room details
      const { details } = await vacantRoomsByBedType(
        hostelId,
        bedType,
        roomNumber
      );

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

  //SECTION Controller method to handle to upload legal documents
  async uploadLegalDocuments(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const { hostelId, legalDocuments } = req.body;

      if (
        !mongoose.isValidObjectId(staffId) ||
        !mongoose.isValidObjectId(hostelId)
      ) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Call the service to upload documnets
      await uploadLegalDocuments(hostelId, legalDocuments, staffId);

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

  async retrivedUploadLegalDocuments(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const { hostelId } = req.body;

      if (
        !mongoose.isValidObjectId(staffId) ||
        !mongoose.isValidObjectId(hostelId)
      ) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Call the service to upload documnets
      const { details } = await retrievedUploadLegalDocuments(hostelId);

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

  //SECTION Controller method to handle to upload legal documents
  async updateMessDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const {
        hostelId,
        messAvailability,
        mealType,
        specialDietary,
        dietaryOptions,
        diningTimeSlot,
      } = req.body;

      if (
        !mongoose.isValidObjectId(staffId) ||
        !mongoose.isValidObjectId(hostelId)
      ) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Call the service to update mess
      await updateMessDetails(
        hostelId,
        messAvailability,
        mealType,
        specialDietary,
        dietaryOptions,
        diningTimeSlot,
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

  async fetchHostelMessDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const { hostelId } = req.body;

      if (
        !mongoose.isValidObjectId(staffId) ||
        !mongoose.isValidObjectId(hostelId)
      ) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Call the service to fetch mess
      const { mess } = await fetchHostelMessDetails(hostelId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: mess,
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

  //SECTION Controller method to fetch room details by hostel id and bed type
  async fetchUserDetailsOfRoom(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { hostelId, bedType, roomNumber } = req.body;

      if (!mongoose.isValidObjectId(hostelId)) {
        throw new Error(INVALID_ID);
      }

      if (!hostelId) {
        const missingField = "Hostel Id";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to fetch User Details Of Room
      const { users } = await fetchUserDetailsOfRoom(
        hostelId,
        bedType,
        roomNumber
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

  //SECTION Controller method to handle fetch payment type By HostelId
  async fetchPaymentOptionsByHostel(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { hostelId } = req.body;

      // Call the service to get bed types
      const { paymentTypes } = await fetchPaymentOptionsByHostel(hostelId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: paymentTypes,
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

  //SECTION Controller method to fetch room details by muliple floor numbers
  async fetchRoomsByMulipleFloorNumbers(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const hostelIdForToken = req.body._valid?.hostelId;
      let { floorNumbers } = req.body;
      let hostelId = req.body.hostelId ?? hostelIdForToken;

      if (!mongoose.isValidObjectId(hostelId)) throw new Error(INVALID_ID);

      if (!hostelId) {
        const missingField = "Hostel Id";

        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: `${missingField} is required`,
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to retrieve room details by hostel id
      const { rooms } = await roomsByMultipleFloorNumbers(
        hostelId,
        floorNumbers
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: rooms,
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

  //SECTION: Controller method to upload room mapping in bulk.
  async uploadRoomMappingInBulk(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {
      const createdById = req.body._valid._id;

      const { hostelId } = req.body;
      const file = req.file;

      if (!file) {
        throw new Error(REQUIRED_FIELD("File"));
      }

      // Respond immediately that the file is being processed
      res.status(200).send({
        statusCode: 200,
        message: FILE_ON_PROCESS,
      });

      const fileUrl = await uploadFileToCloudStorage(
        file,
        HOSTEL_ROOM_MAP_BULK_UPLOAD_FILES
      );
      const url = fileUrl && fileUrl.Key ? fileUrl?.Key : null;

      // Perform file processing after sending response
      const jsonData = await excelToJson(file.buffer);
      await uploadRoomMappingInBulk(
        jsonData,
        hostelId,
        createdById,
        url as string
      );
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };

      return res.status(400).json(errorResponse);
    }
  }

   async fetchFloorsRooms(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse> | void> {
    try {

      const { hostelId } = req.body?._valid;
     
     const {floorRooms} = await fetchFloorRooms(hostelId)
      res.json({floorRooms})
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

export default new HostelController();
