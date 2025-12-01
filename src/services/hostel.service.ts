import mongoose from "mongoose";
import Hostel, {
  IHostel,
  IBedDetails,
  IImageDetails,
  IVisitingHours,
  IEmergencyNumber,
  IRoomDetails,
  IBedNumberDetails,
} from "../models/hostel.model";
import User from "../models/user.model";
import College from "../models/university.model";
import { excelDateToJSDate, getCurrentISTTime } from "../utils/lib";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";
import {
  BedTypes,
  BulkUploadTypes,
  DietaryOptionsTypes,
  MealTypes,
  OccupancyTypes,
  RoomCoolingType,
  RoomMaintenanceStatusType,
  WashroomTypes,
} from "../utils/enum";
import StudentHostelAllocation from "../models/studentHostelAllocation.model";
import {
  getSignedUrl,
  pushToS3Bucket,
  uploadFileInS3Bucket,
} from "../utils/awsUploadService";
import {
  HOSTEL_IMAGES,
  HOSTEL_ROOM_MAP_BULK_UPLOAD_FILES,
  LEGAL_DOCUMENTS,
} from "../utils/s3bucketFolder";
import BulkUpload from "../models/bulkUpload.model";
import { normalizeBedNumber } from "../utils/normalizeBedNumber";

const {
  DUPLICATE_RECORD,
  RECORD_NOT_FOUND,
  IMAGE_UPLOAD_ERROR,
  UPLOAD_DOUMENT_ERROR,
  NO_DOCUMENTS_FOUND,
  BED_TYPE_MISMATCH,
} = ERROR_MESSAGES;
const { DELETE_DATA, UPDATE_DATA, COLLEGE_AND_RELATED_ENTITIES_ACTIVATED } =
  SUCCESS_MESSAGES;
const { INVALID_TIME_FORMAT } = VALIDATION_MESSAGES;

class HostelService {
  //SECTION: Method to create a new hostel
  createNewHostel = async (
    universityId: mongoose.Types.ObjectId,
    name: string,
    identifier: string,
    buildingNumber: string,
    address: string,
    image: IImageDetails[],
    description: string,
    securityFee: number,
    amenitieIds: mongoose.Types.ObjectId[],
    bedDetails: IBedDetails[],
    isAgreementRequired: boolean,
    visitingHours: IVisitingHours[],
    emergencyNumbers: IEmergencyNumber,
    securityDetails: any,
    status: boolean,
    createdBy: mongoose.Types.ObjectId
  ): Promise<IHostel> => {
    try {
      const existingHostel = await Hostel.findOne({ identifier });
      if (existingHostel) {
        throw new Error(DUPLICATE_RECORD("Identifier"));
      }

      //NOTE: Check for duplicate bedTypes
      const uniqueBedTypes = new Set<BedTypes>();
      for (const bedDetail of bedDetails) {
        if (uniqueBedTypes.has(bedDetail.bedType)) {
          throw new Error(DUPLICATE_RECORD("Bed Type"));
        }

        uniqueBedTypes.add(bedDetail.bedType);
      }

      // Validate visitingHours using map
      const hasInvalidVisitingHours = visitingHours.some((visitingHour) => {
        if (visitingHour.isVisitorAllowed) {
          if (!visitingHour.startTime || !visitingHour.endTime) return true;

          const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
          return (
            !timeRegex.test(visitingHour.startTime) ||
            !timeRegex.test(visitingHour.endTime)
          );
        }
        return false;
      });

      if (hasInvalidVisitingHours)
        throw new Error(INVALID_TIME_FORMAT("visitors"));

      // Validate and update securityDetails
      if (securityDetails?.availablity) {
        securityDetails.startTime = null;
        securityDetails.endTime = null;
      } else {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (
          !timeRegex.test(securityDetails?.startTime) ||
          !timeRegex.test(securityDetails?.endTime)
        )
          throw new Error(INVALID_TIME_FORMAT("security Details"));
      }

      const hostelImages = await Promise.all(
        image.map(async (imageUrl) => {
          if (imageUrl?.url && imageUrl?.url.includes("base64")) {
            const uploadImage = await uploadFileInS3Bucket(
              imageUrl.url,
              HOSTEL_IMAGES
            );
            if (uploadImage !== false) return { url: uploadImage.Key };
            else throw new Error(IMAGE_UPLOAD_ERROR);
          }
        })
      );

      // Calculate total capacity from bedDetails
      const totalCapacity = bedDetails.reduce((total, bedDetail) => {
        return total + (bedDetail?.totalBeds || 0);
      }, 0);

      // Calculate total room from bedDetails
      const totalRoom = bedDetails.reduce((total, bedDetail) => {
        return total + (bedDetail?.numberOfRooms || 0);
      }, 0);

      ///NOTE - create new hostel
      const newHostel = new Hostel({
        universityId,
        name,
        identifier,
        buildingNumber,
        address,
        image: hostelImages,
        description,
        bedDetails,
        securityFee,
        amenitieIds,
        totalCapacity,
        isAgreementRequired,
        visitingHours,
        emergencyNumbers,
        totalBed: totalCapacity,
        totalRoom,
        securityDetails,
        status: status ? status : true,
        createdBy,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      // Step 4: Save the new hostel
      return await newHostel.save();
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get a hostel for web
  getHostelWeb = async (): Promise<{ hostel: any }> => {
    try {
      //get hostel details
      const hostel = await Hostel.find({ status: true })
        .select("name")
        .sort({ createdAt: -1 })
        .lean();

      return { hostel };
    } catch (error: any) {
      throw new Error(`Failed to create hostel: ${error.message}`);
    }
  };

  //SECTION: Method to get all hostel
  hostelWithPagination = async (
    page: number,
    limit: number,
    search?: string
  ): Promise<{ hostels: any[]; count: number }> => {
    try {
      // Calculate the number of documents to skip
      const skip = (page - 1) * limit;

      // Build search parameters based on search input
      const searchParams = search
        ? {
          $or: [{ name: { $regex: `^${search}`, $options: "i" } }],
        }
        : {};

      // Run both queries in parallel
      const [count, hostels] = await Promise.all([
        Hostel.countDocuments({
          $and: [{ ...searchParams }],
        }),
        Hostel.find({
          $and: [{ ...searchParams }],
        })
          .populate([{ path: "createdBy", select: "name" }])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select("-bedDetails"),
      ]);

      // Map the result to return necessary fields
      const result = hostels.map((ele) => ({
        _id: ele._id,
        name: ele.name ?? null,
        identifier: ele.identifier ?? null,
        buildingNumber: ele.buildingNumber ?? null,
        totalCapacity: ele?.totalCapacity ?? 0,
        address: ele.address ?? null,
        description: ele.description ?? null,
        securityFee: ele?.securityFee ?? null,
        status: ele?.status,
        isRoomMapped: !!ele?.roomMapping,
        isMessDetailsAdded: !!ele?.messDetails,
        isLegalDocumentsAdded: !!ele?.legalDocuments,
        isAgreementRequired: ele?.isAgreementRequired,
        createdBy: (ele?.createdBy as any)?.name ?? null,
        createdAt: ele?.createdAt ?? null,
      }));

      return { hostels: result, count };
    } catch (error: any) {
      throw new Error(`Failed to retrieve hostel: ${error.message}`);
    }
  };

  //SECTION: Method to get hostel by id
  getHostelById = async (id: string): Promise<{ hostel: any }> => {
    try {
      const hostel = await Hostel.findById(id)
        .populate("universityId", "name")
        .populate("amenitieIds", "name")
        .select(
          "-messDetails -createdAt -updatedAt -createdBy -updatedBy -__v -bedDetails.createdAt -bedDetails.updatedAt -roomMapping"
        );

      if (!hostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      const hostelImages = await Promise.all(
        hostel?.image?.map(async (imageUrl: { url: string; _id: any }) => {
          if (imageUrl?.url) {
            const signedUrl = await getSignedUrl(imageUrl.url);
            return { _id: imageUrl._id, url: signedUrl };
          }
        })
      );
      const response = {
        _id: hostel._id,
        universityId: hostel?.universityId,
        name: hostel?.name ?? null,
        identifier: hostel?.identifier ?? null,
        buildingNumber: hostel?.buildingNumber ?? null,
        address: hostel.address ?? null,
        description: hostel?.description ?? null,
        image: hostelImages,
        amenitieIds: hostel.amenitieIds ?? null,
        isAgreementRequired: hostel.isAgreementRequired ?? null,
        securityFee: hostel.securityFee ?? null,
        bedDetails: hostel.bedDetails ?? null,
        visitingHours: hostel?.visitingHours ?? null,
        emergencyNumbers: hostel?.emergencyNumbers ?? null,
        securityDetails: hostel?.securityDetails ?? null,
      };

      return { hostel: response };
    } catch (error: any) {
      throw new Error(`Failed to retrieve hostels: ${error.message}`);
    }
  };

  //SECTION: Method to delete hostel by id
  deleteHostelById = async (
    id: string,
    status: boolean,
    staffId: string
  ): Promise<{ message: string }> => {
    try {
      const currentTime = getCurrentISTTime();
      const deletData = await Hostel.findByIdAndUpdate(id, {
        $set: { status, updatedBy: staffId, updatedAt: currentTime },
      });

      if (!deletData) throw new Error(RECORD_NOT_FOUND("Hostel"));

      // NOTE: Check if users exist for these hostels
      const userCount = await User.countDocuments({
        hostelId: id,
      });

      //NOTE: If user found then update.
      if (userCount > 0) {
        // NOTE: Update users related to hostels
        await User.updateMany(
          { hostelId: id },
          {
            $set: {
              status,
              updatedBy: staffId,
              updatedAt: currentTime,
            },
          }
        );
      }
      return {
        message: status
          ? COLLEGE_AND_RELATED_ENTITIES_ACTIVATED("Hostel")
          : DELETE_DATA,
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to update a hostel by id
  updateHostelById = async (
    id: string,
    universityId: mongoose.Types.ObjectId,
    name: string,
    identifier: string,
    buildingNumber: string,
    address: string,
    image: IImageDetails[],
    description: string,
    securityFee: number,
    amenitieIds: mongoose.Types.ObjectId[],
    bedDetails: IBedDetails[],
    isAgreementRequired: boolean,
    visitingHours: IVisitingHours[],
    emergencyNumbers: IEmergencyNumber,
    securityDetails: any,
    status: boolean,
    updatedBy?: mongoose.Types.ObjectId
  ): Promise<string> => {
    try {
      // 1. Check if the hostel with the specified ID exists
      const existingHostel = await Hostel.findById(id);
      if (!existingHostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      const isUniqueUrl = await Hostel.findOne({
        _id: { $ne: existingHostel._id },
        identifier,
      });

      if (isUniqueUrl) throw new Error(DUPLICATE_RECORD("Identifier"));

      // 2. Check for duplicate bed types using Set
      const bedTypeSet = new Set<number>();
      bedDetails.forEach((bed) => {
        if (bedTypeSet.has(bed.bedType)) {
          throw new Error(DUPLICATE_RECORD("Bed Type"));
        }
        bedTypeSet.add(bed.bedType);
      });

      // Validate visitingHours using map
      const hasInvalidVisitingHours = visitingHours.some((visitingHour) => {
        if (visitingHour.isVisitorAllowed) {
          if (!visitingHour.startTime || !visitingHour.endTime) return true;

          const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
          return (
            !timeRegex.test(visitingHour.startTime) ||
            !timeRegex.test(visitingHour.endTime)
          );
        }
        return false;
      });

      if (hasInvalidVisitingHours)
        throw new Error(INVALID_TIME_FORMAT("visitors"));

      // Validate and update securityDetails
      if (securityDetails?.availablity) {
        securityDetails.startTime = null;
        securityDetails.endTime = null;
      } else {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (
          !timeRegex.test(securityDetails?.startTime) ||
          !timeRegex.test(securityDetails?.endTime)
        )
          throw new Error(INVALID_TIME_FORMAT("Security Details"));
      }

      // 3. Update bed details by either updating existing ones or adding new ones
      const updatedBedDetails = bedDetails.map((bed) => {
        const existingBedDetail = existingHostel.bedDetails.find(
          (detail: any) => detail._id.equals(bed._id)
        );

        if (existingBedDetail) {
          // Update existing bed detail
          return {
            ...existingBedDetail.toObject(),
            bedType: bed.bedType,
            numberOfRooms: bed.numberOfRooms,
            totalBeds: bed.totalBeds,
            accommodationFee: bed.accommodationFee,
          };
        }

        // Add new bed detail
        return bed;
      });

      // Calculate total capacity from updated bedDetails
      const totalCapacity = updatedBedDetails.reduce((total, bedDetail) => {
        return total + (bedDetail.totalBeds || 0); // Ensure totalBeds is not undefined
      }, 0);

      // Calculate total room from bedDetails
      const totalRoom = updatedBedDetails.reduce((total, bedDetail) => {
        return total + (bedDetail?.numberOfRooms || 0);
      }, 0);

      const updateImageUrl: any[] = [];
      if (image) {
        for (const data of image) {
          // Check if the imageUrl exists in the existingHostel's image
          const existImage = (existingHostel.image as any[]).find((item: any) =>
            item._id.equals(data._id)
          );

          if (existImage) {
            if (data && data.url.includes("base64")) {
              // If the image exists and there is base64 data, upload and update the image
              const uploadImage = await uploadFileInS3Bucket(
                data.url,
                HOSTEL_IMAGES
              );

              if (uploadImage !== false) {
                data.url = uploadImage.Key;
                updateImageUrl.push(data);
              } else {
                throw new Error(IMAGE_UPLOAD_ERROR);
              }
            } else {
              // If there is no base64 data, keep the existing image
              updateImageUrl.push(existImage);
            }
          } else {
            // If the image does not exist, upload and add the new image
            if (data && data.url.includes("base64")) {
              const uploadImage = await uploadFileInS3Bucket(
                data.url,
                HOSTEL_IMAGES
              );

              if (uploadImage !== false) {
                data.url = uploadImage.Key;
                updateImageUrl.push(data);
              } else {
                throw new Error(IMAGE_UPLOAD_ERROR);
              }
            }
          }
        }
      }

      //Update the hostel document
      await Hostel.findByIdAndUpdate(id, {
        $set: {
          universityId,
          name,
          identifier,
          buildingNumber,
          address,
          image: updateImageUrl,
          description,
          bedDetails: updatedBedDetails,
          securityFee,
          amenitieIds,
          totalCapacity,
          isAgreementRequired,
          visitingHours,
          emergencyNumbers,
          totalBed: totalCapacity,
          totalRoom,
          securityDetails,
          status: status ?? true,
          updatedBy,
          updatedAt: getCurrentISTTime(),
        },
      });

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to add and update room details
  roomMappingAddorUpdate = async (
    hostelId: mongoose.Types.ObjectId,
    roomDetails: any[],
    staffId: mongoose.Types.ObjectId
  ): Promise<string> => {
    try {
      //Check if the hostel with the specified ID exists
      const existingHostel = await Hostel.findById(hostelId);
      if (!existingHostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      // Calculate total unique floor count
      const uniqueFloors = new Set(roomDetails.map((ele) => ele?.floorNumber));
      const totalUniqueFloors = uniqueFloors.size;

      // Calculate total room count
      const totalRooms = roomDetails.length;

      //NOTE - create room mapping payload
      const roomDetailsData = roomDetails.map((ele) => ({
        bedType: ele?.bedType,
        roomNumber: ele?.roomNumber,
        floorNumber: ele?.floorNumber,
        totalBeds: ele?.bedType,
        bedNumbers: ele?.bedNumbers?.map((b: IBedNumberDetails) => ({
          ...b,
          bedNumber: normalizeBedNumber(b?.bedNumber)
        })),
        vacant: ele?.occupied ? ele?.bedType - ele?.occupied : ele?.bedType - 0,
        occupied: ele?.occupied ?? 0,
        maintenanceStatus: ele?.maintenanceStatus,
        roomType: ele?.roomType,
        occupancyType: ele?.occupancyType,
        washroomType: ele?.washroomType,
      }));
      // console.log(roomDetailsData, "roomDetails")
      //NOTE - update the room details
      await Hostel.findByIdAndUpdate(hostelId, {
        $set: {
          roomMapping: roomDetailsData,
          totalFloor: totalUniqueFloors,
          totalRoom: totalRooms,
          updatedBy: staffId,
        },
      });

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get hostel mapped rrom
  retrieveMapppedRoom = async (
    hostelId: mongoose.Types.ObjectId
  ): Promise<{
    rooms: any[];
    counts: {
      totalCapacity: number;
      totalFloor: number;
      totalRoom: number;
      totalBed: number;
    };
  }> => {
    try {
      const hostel = await Hostel.findById(hostelId).select(
        "roomMapping totalCapacity totalFloor totalRoom totalBed"
      );

      if (!hostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      const result =
        (hostel &&
          hostel?.roomMapping?.map((ele) => ({
            bedType: ele.bedType ?? null,
            roomNumber: ele.roomNumber ?? null,
            floorNumber: ele.floorNumber ?? null,
            totalBeds: ele.totalBeds ?? null,
            bedNumbers: ele.bedNumbers ?? null,
            vacant: ele.vacant ?? null,
            occupied: ele.occupied ?? null,
            maintenanceStatus: ele.maintenanceStatus ?? null,
            roomType: ele.roomType ?? null,
            occupancyType: ele?.occupancyType ?? null,
            washroomType: ele?.washroomType ?? null,
          }))) ||
        [];

      const totalCount = {
        totalCapacity: hostel?.totalCapacity ?? 0,
        totalFloor: hostel?.totalFloor ?? 0,
        totalRoom: hostel?.totalRoom ?? 0,
        totalBed: hostel?.totalBed ?? 0,
      };

      return { rooms: result, counts: totalCount };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to fetch Hostel For User
  fetchHostelForUser = async (userId: string): Promise<{ hostel: any }> => {
    try {
      //NOTE - get hostel details based on the user
      const user: any = await User.findById(userId).populate([
        { path: "hostelId", select: "name address phone description" },
      ]);
      const details = await StudentHostelAllocation.findOne({
        studentId: user._id,
        hostelId: user?.hostelId,
      }).select("roomNumber bedNumber floorNumber");

      const roomMates = await User.find({
        hostelId: user.hostelId,
        _id: { $ne: user._id },
        uniqueId: { $ne: null },
        isVerified: true,
      }).select("name phone hostelId");

      const roomMatesData = await Promise.all(
        roomMates.map(async (data: any) => {
          const roomDetails = await StudentHostelAllocation.findOne({
            studentId: data._id,
            hostelId: data.hostelId,
          })
            .select("roomNumber bedNumber")
            .sort({ createdAt: -1 })
            .lean();
          if (roomDetails?.roomNumber === details?.roomNumber) {
            return {
              _id: data._id,
              name: data.name ?? null,
            };
          }
          return null;
        })
      );
      const filteredRoomMatesData = roomMatesData.filter(Boolean)
      const hostel = {
        _id: user?.hostelId?._id,
        name: user?.hostelId?.name ?? null,
        address: user?.hostelId?.address ?? null,
        description: user?.hostelId?.description ?? null,
        phone: user?.phone ?? null,
        guardianContactNo: (user?.familiyDetails?.fatherNumber || user?.familyDetails?.motherNumber) ?? null,
        roomMates: filteredRoomMatesData.map((ele) => ele?.name ?? null),
        floorNumber: details?.floorNumber ?? null,
        bedDetails: details
          ? `${details.roomNumber ?? null}/${details?.bedNumber ?? null}`
          : null,
      };
      return { hostel };
    } catch (error: any) {
      throw new Error(`Failed to fetch hostel: ${error.message}`);
    }
  };

  //SECTION: Method to get bed Types By Hostel Id
  bedTypesByHostelId = async (hostelId: string): Promise<{ bedTypes: any }> => {
    try {
      const data: any = await Hostel.findById(hostelId).select(
        "-createdAt -updatedAt -createdBy -updatedBy -__v"
      );

      if (!data) {
        return { bedTypes: [] };
      }

      const transformedData = data.bedDetails.map((ele: any) => ({
        _id: ele._id,
        bedType: ele.bedType ?? null,
        numberOfRooms: ele?.numberOfRooms ?? null,
        totalBeds: ele.totalBeds ?? null,
        accommodationFee: ele.accommodationFee ?? null,
      }));

      return { bedTypes: transformedData };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get room details by hostel id and bed type and floor number
  getRoomsByBedType = async (
    hostelId: string,
    floorNumber?: number,
    bedType?: BedTypes
  ): Promise<{ rooms: any[] }> => {
    try {
      const matchConditions: any[] = [];

      if (bedType) {
        matchConditions.push({ $eq: ["$$room.bedType", bedType] });
      }

      if (floorNumber) {
        matchConditions.push({ $eq: ["$$room.floorNumber", floorNumber] });
      }

      const result = await Hostel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(hostelId) } },
        {
          $project: {
            roomMapping: {
              $filter: {
                input: "$roomMapping",
                as: "room",
                cond: { $and: matchConditions },
              },
            },
          },
        },
        {
          $project: {
            "roomMapping.roomNumber": 1,
            "roomMapping.bedNumbers": 1,
            "roomMapping.floorNumber": 1,
            "roomMapping.bedType": 1,
            "roomMapping.totalBeds": 1,
            "roomMapping.vacant": 1,
            "roomMapping.occupied": 1,
          },
        },
      ]);

      if (!result || !result.length || !result[0].roomMapping.length) {
        throw new Error(RECORD_NOT_FOUND("Room"));
      }

      return { rooms: result[0].roomMapping };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get floor details by hostel id and bed type
  fetchFloorByBedTypeAndHostelId = async (
    hostelId: string,
    bedType?: BedTypes
  ): Promise<{ floorNumbers: { _id: string; floorNumber: number }[] }> => {
    try {
      const matchConditions: any = {
        _id: new mongoose.Types.ObjectId(hostelId),
      };

      if (bedType) {
        matchConditions["roomMapping.bedType"] = bedType;
      }

      const result = await Hostel.aggregate([
        { $match: matchConditions },
        {
          $project: {
            roomMapping: bedType
              ? {
                $filter: {
                  input: "$roomMapping",
                  as: "room",
                  cond: { $eq: ["$$room.bedType", bedType] },
                },
              }
              : "$roomMapping",
          },
        },
        { $unwind: "$roomMapping" },
        { $group: { _id: "$roomMapping.floorNumber" } },
        { $project: { _id: 0, floorNumber: "$_id" } },
      ]);

      if (!result || !result.length) throw new Error(RECORD_NOT_FOUND("Floor"));

      const response = result.map((item) => ({
        _id: hostelId,
        floorNumber: item?.floorNumber,
      }));

      return { floorNumbers: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get vacant Rooms By BedType
  vacantRoomsByBedType = async (
    hostelId: string,
    bedType: BedTypes,
    roomNumber: number
  ): Promise<{ details: string }> => {
    try {
      const [result] = await Hostel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(hostelId) } },
        {
          $project: {
            roomMapping: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$roomMapping",
                    as: "room",
                    cond: {
                      $and: [
                        { $eq: ["$$room.floorNumber", bedType] },
                        { $eq: ["$$room.roomNumber", roomNumber] },
                      ],
                    },
                  },
                },
                0,
              ],
            },
          },
        },
        {
          $project: {
            vacant: {
              $concat: [
                { $toString: "$roomMapping.vacant" },
                "/",
                { $toString: "$roomMapping.totalBeds" },
              ],
            },
          },
        },
      ]);
      if (!result) {
        throw new Error(RECORD_NOT_FOUND("Room"));
      }

      return { details: result };
    } catch (error: any) {
      throw new Error(`Failed to fetch hostel bedtype: ${error.message}`);
    }
  };

  //SECTION: Method to upload Legal Documents
  uploadLegalDocuments = async (
    hostelId: string,
    legalDocuments: {
      conductPdf: string;
      refundPolicy: string;
      allocationRule: string;
    },
    staffId: string
  ): Promise<string> => {
    try {
      // Fetch hostel details and check if `isAgreementRequired` is true
      const hostel = await Hostel.findOne({ _id: hostelId });
      if (!hostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      if (!hostel.isAgreementRequired) throw new Error(UPLOAD_DOUMENT_ERROR);

      // Get the existing legal documents from the hostel record
      const existingLegalDocuments: any = hostel.legalDocuments || {};

      // Upload PDFs to S3 or retain existing documents
      const uploadedDocuments = await Promise.all(
        Object.entries(legalDocuments).map(async ([key, file]) => {
          if (file && file.includes("base64")) {
            const uploadedFile = await uploadFileInS3Bucket(
              file,
              LEGAL_DOCUMENTS
            );
            if (uploadedFile !== false) {
              return { [key]: uploadedFile.Key };
            } else {
              throw new Error(`${key} upload failed.`);
            }
          } else {
            // If file is not in base64 format, retain the existing value
            if (existingLegalDocuments[key]) {
              return { [key]: existingLegalDocuments[key] };
            } else {
              throw new Error(
                `${key} is invalid or not in base64 format, and no existing value found.`
              );
            }
          }
        })
      );

      // Merge uploaded file keys into a single object
      const uploadedDetails = uploadedDocuments.reduce(
        (acc, curr) => ({ ...acc, ...curr }),
        {}
      );

      // Update hostel with new legal documents
      await Hostel.findByIdAndUpdate(hostelId, {
        $set: { legalDocuments: uploadedDetails, updatedBy: staffId },
      });

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(`Failed to upload legal documents: ${error.message}`);
    }
  };

  //SECTION: Method to retrived Upload Legal Documents
  retrievedUploadLegalDocuments = async (
    hostelId: string
  ): Promise<{ details: any }> => {
    try {
      // Fetch hostel details and check if `isAgreementRequired` is true
      const hostel = await Hostel.findOne({ _id: hostelId }).lean();
      if (!hostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      if (!hostel.isAgreementRequired) {
        throw new Error(NO_DOCUMENTS_FOUND);
      }

      // Ensure legalDocuments exist in the hostel record
      if (
        !hostel.legalDocuments ||
        Object.keys(hostel.legalDocuments).length === 0
      ) {
        return {
          details: {
            _id: hostel?._id,
            legalDocuments: {
              conductPdf: null,
              refundPolicy: null,
              allocationRule: null,
            },
          },
        };
      }

      // Convert URLs in legalDocuments to signed URLs
      const signedLegalDocuments = await Promise.all(
        Object.entries(hostel.legalDocuments).map(async ([key, url]) => {
          if (url && typeof url === "string" && url.trim() !== "") {
            // Ensure the URL is valid and not empty
            try {
              const signedUrl = await getSignedUrl(url); // Generate signed URL
              return { [key]: signedUrl };
            } catch (err) {
              return { [key]: null }; // Return null if there's an error
            }
          }
          return { [key]: null }; // Handle null or invalid URLs
        })
      );

      // Merge signed URLs into a single object
      const signedDocumentDetails = signedLegalDocuments.reduce(
        (acc, curr) => ({ ...acc, ...curr }),
        {}
      );

      return {
        details: {
          _id: hostel._id,
          legalDocuments: signedDocumentDetails,
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to retrieve legal documents: ${error.message}`);
    }
  };

  //SECTION: Method to update Mess Details
  updateMessDetails = async (
    hostelId: string,
    messAvailability: boolean,
    mealType: MealTypes,
    specialDietary: boolean,
    dietaryOptions: DietaryOptionsTypes[],
    diningTimeSlot: any[],
    staffId: string
  ): Promise<string> => {
    try {
      // Update the messDetails in the hostel document
      const updatedHostel = await Hostel.findByIdAndUpdate(
        hostelId,
        {
          $set: {
            messDetails: {
              messAvailability,
              mealType,
              specialDietary,
              dietaryOptions,
              diningTimeSlot,
            },
            updatedBy: staffId,
            updatedAt: getCurrentISTTime(),
          },
        },
        { new: true }
      );

      // Check if hostel exists
      if (!updatedHostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(`Failed to update mess details: ${error.message}`);
    }
  };

  //SECTION: Method to get Mess Details
  fetchHostelMessDetails = async (hostelId: string): Promise<{ mess: any }> => {
    try {
      // Find the hostel by its ID and retrieve only the messDetails
      const hostel = await Hostel.findById(hostelId).select("messDetails");

      // Check if hostel exists
      if (!hostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      const result = {
        _id: hostel._id,
        messDetails: hostel.messDetails ?? null,
      };

      // Return the messDetails
      return { mess: result };
    } catch (error: any) {
      throw new Error(`Failed to fetch hostel mess details: ${error.message}`);
    }
  };

  //SECTION: Method to fetch User Details Of Room
  fetchUserDetailsOfRoom = async (
    hostelId: string,
    bedType?: BedTypes,
    roomNumber?: number
  ): Promise<{
    users: { _id: string; name: string | null; image: string | null }[];
  }> => {
    try {
      const searchParams: any = {
        hostelId: new mongoose.Types.ObjectId(hostelId),
      };
      if (bedType) {
        searchParams.bedType = bedType;
      }
      if (roomNumber) {
        searchParams.roomNumber = roomNumber;
      }

      // Fetch students allocated to the specified room
      const validity = await StudentHostelAllocation.find(searchParams).select(
        "studentId"
      );

      if (!validity.length) {
        return { users: [] };
      }

      // Fetch user details based on student IDs
      const roomMates = await User.find({
        _id: { $in: validity.map((ele) => ele.studentId) },
      }).select("_id name image");

      // Map and process user details asynchronously
      const users = await Promise.all(
        roomMates.map(async (ele: any) => ({
          _id: ele._id,
          name: ele.name ?? null,
          image: ele.image ? await getSignedUrl(ele.image) : null,
        }))
      );

      return { users };
    } catch (error: any) {
      throw new Error(
        `Failed to fetch user details for the room: ${error.message}`
      );
    }
  };

  //SECTION: Method to fetch Payment Options By Hostel
  fetchPaymentOptionsByHostel = async (
    hostelId: string
  ): Promise<{ paymentTypes: any[] }> => {
    try {
      const result = await Hostel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(hostelId) } },
        {
          $lookup: {
            from: "colleges",
            localField: "universityId",
            foreignField: "_id",
            as: "university",
          },
        },
        { $unwind: "$university" },
        { $project: { paymentTypes: "$university.paymentTypes" } },
      ]);

      if (!result || result.length === 0)
        throw new Error(RECORD_NOT_FOUND("Hostel or University"));

      return { paymentTypes: result[0].paymentTypes };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get rooms By Muliple Floor Numbers
  roomsByMultipleFloorNumbers = async (
    hostelId: string,
    floorNumbers: number[]
  ): Promise<{ rooms: any[] }> => {
    try {
      const result = await Hostel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(hostelId) } },
        { $unwind: "$roomMapping" },
        {
          $match: {
            "roomMapping.floorNumber": { $in: floorNumbers },
          },
        },
        {
          $project: {
            _id: 1,
            roomNumber: "$roomMapping.roomNumber",
            floorNumber: "$roomMapping.floorNumber",
            bedType: "$roomMapping.bedType",
          },
        },
      ]);

      if (!result) {
        return { rooms: [] };
      }

      return { rooms: result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to upload hotel room mapping in bulk
  uploadRoomMappingInBulk = async (
    json: any[],
    hostelId: string,
    createdById?: string,
    url?: string
  ): Promise<string> => {
    try {
      const successArray: any[] = [];
      const errorArray: any[] = [];

      const existingHostel = await Hostel.findById(hostelId);
      if (!existingHostel) {
        throw new Error(RECORD_NOT_FOUND("Hostel"));
      }
      // Create bulk upload entry
      const bulkUpload = await BulkUpload.create({
        originalFile: url,
        fileType: BulkUploadTypes.HOSTEL_ROOM_MAP,
        createdBy: createdById,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });
      const existingRoomNumbers = new Set<number>(
        existingHostel.roomMapping?.map((room: any) => room.roomNumber) || []
      );

      const bedTypeMap: Record<string, number> = {
        single: 1,
        double: 2,
        triplet: 3,
        quadrille: 4,
      };

      const newRoomMappings: any[] = [];

      for (const row of json) {
        const roomNumber = Number(row.RoomNumber);
        const bedTypeStr = (row.BedType || "").toLowerCase();
        const bedType = bedTypeMap[bedTypeStr];

        if (!bedType || isNaN(roomNumber)) {
          errorArray.push({ ...row, reason: "Invalid BedType or RoomNumber" });
          continue;
        }

        if (existingRoomNumbers.has(roomNumber)) {
          errorArray.push({ ...row, reason: DUPLICATE_RECORD("RoomNumber") });
          continue;
        }

        const bedList = String(row.BedNumber || "")
          .split(",")
          .map((bed: string) => bed.trim())
          .filter((bed: string) => bed.length > 0);

        // ❗ Add bed count validation here
        if (bedList.length !== bedType) {
          errorArray.push({
            ...row,
            reason: BED_TYPE_MISMATCH(bedList.length, bedTypeStr, bedType),
          });
          continue;
        }

        const bedNumbers = bedList.map((bed: string) => ({
          bedNumber: bed,
          isVacant: true,
        }));

        const roomData = {
          bedType,
          roomNumber,
          floorNumber: Number(row.FloorNumber),
          totalBeds: bedNumbers.length,
          bedNumbers,
          vacant: bedNumbers.length,
          occupied: 0,
          maintenanceStatus: row.MaintenanceStatus,
          roomType: row.RoomType,
          occupancyType: row.OccupancyType,
          washroomType: row.WashroomType,
          isAssignedToStaff: false,
        };

        newRoomMappings.push(roomData);
        successArray.push({ ...row, status: "Uploaded" });
      }

      if (newRoomMappings.length > 0) {
        await Hostel.findByIdAndUpdate(
          hostelId,
          {
            $push: { roomMapping: { $each: newRoomMappings } },
            $set: {
              updatedAt: new Date(),
              ...(createdById && {
                updatedBy: new mongoose.Types.ObjectId(createdById),
              }),
            },
          },
          { new: true }
        );
        console.log("created");
      }
      // Upload result filess
      let successFileUrl: string | null = null;
      let errorFileUrl: string | null = null;

      if (successArray.length > 0) {
        successFileUrl = await pushToS3Bucket(
          successArray,
          process.env.S3_BUCKET_NAME!,
          HOSTEL_ROOM_MAP_BULK_UPLOAD_FILES
        );
      }

      if (errorArray.length > 0) {
        errorFileUrl = await pushToS3Bucket(
          errorArray,
          process.env.S3_BUCKET_NAME!,
          HOSTEL_ROOM_MAP_BULK_UPLOAD_FILES
        );
      }

      await BulkUpload.findByIdAndUpdate(bulkUpload._id, {
        $set: {
          successFile: successFileUrl,
          errorFile: errorFileUrl,
          updatedAt: getCurrentISTTime(),
        },
      });

      return `Upload complete. Success: ${successArray.length}, Failed: ${errorArray.length}`;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };


  fetchFloorRooms = async (
    hostelId: string,
  ): Promise<{ floorRooms: any[] }> => {
    try {
     
      const result = await Hostel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(hostelId) } },

        // Unwind roomMapping
        { $unwind: "$roomMapping" },

        // Only rooms with vacant beds
        { $match: { "roomMapping.vacant": { $gt: 0 } } },

        // Filter only vacant bedNumbers
        {
          $addFields: {
            "roomMapping.bedNumbers": {
              $filter: {
                input: "$roomMapping.bedNumbers",
                as: "bed",
                cond: { $eq: ["$$bed.isVacant", true] }
              }
            }
          }
        },

        // Group by floorNumber
        {
          $group: {
            _id: "$roomMapping.floorNumber",
            rooms: {
              $push: {
                roomNumber: "$roomMapping.roomNumber",
                bedType: "$roomMapping.bedType",
                bedNumbers: "$roomMapping.bedNumbers"
              }
            },
            buildingNumber: { $first: "$buildingNumber" }
          }
        },

        // Rename _id → floorNumber
        {
          $project: {
            _id: 0,
            floorNumber: "$_id",
            rooms: 1,
            buildingNumber:1
          }
        },

        // Optional: sort by floorNumber
        { $sort: { floorNumber: 1 } }
      ]);
      return { floorRooms: result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

}

export default new HostelService();
