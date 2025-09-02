import College from "../models/university.model";
import Hostel from "../models/hostel.model";
import User from "../models/user.model";
import {
  BillingCycleTypes,
  HostelTypes,
  MealTypes,
  RoomTypes,
} from "../utils/enum";
import { getCurrentISTTime } from "../utils/lib";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "../utils/messages";

const {
  CREATE_DATA,
  UPDATE_DATA,
  DELETE_DATA,
  COLLEGE_AND_RELATED_ENTITIES_ACTIVATED,
} = SUCCESS_MESSAGES;
const { RECORD_NOT_FOUND } = ERROR_MESSAGES;

class CollegeService {
  //SECTION: Method to create a new college
  async createNewCollege(
    totalCapacity: number,
    name: string,
    address: string,
    googleMapLink: string,
    location: { state: string; city: string; country: string },
    courseIds: string[],
    hostelDetails: {
      hostelType: HostelTypes;
      noOfBuildings: number;
      noOfBeds: number;
    }[],
    roomTypes: RoomTypes[],
    paymentTypes: BillingCycleTypes[],
    mealTypes: MealTypes[],
    evChargingStation: number,
    parkingSpaces: number,
    createdById: string
  ): Promise<string> {
    try {
      // Check if a college with the same name already exists
      const existingCollege = await College.findOne({ name });
      if (existingCollege) {
        throw new Error(`College with the name '${name}' already exists.`);
      }

      // Create the new college
      await College.create({
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
        createdBy: createdById,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get all college
  async getAllCollegesWithPagination(
    page: number,
    limit: number,
    search?: string
  ): Promise<{ colleges: any[]; count: number }> {
    try {
      // Calculate the number of documents to skip
      const skip = (page - 1) * limit;

      // Build the query for searching course
      const query: { name?: { $regex: RegExp } } = {};
      if (search) {
        query.name = { $regex: new RegExp(`\\b${search}\\b`, "i") };
      }

      // Run both queries in parallel
      const [courses, count] = await Promise.all([
        College.find(query)
          .populate([{ path: "createdBy", select: "name" }])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        College.countDocuments(query),
      ]);

      //NOTE - send response
      const response = courses.map((ele) => ({
        _id: ele._id,
        name: ele?.name ?? null,
        totalCapacity: ele?.totalCapacity ?? 0,
        address: ele?.address ?? null,
        googleMapLink: ele?.googleMapLink ?? null,
        location: ele?.address ?? null,
        evChargingStation: ele?.evChargingStation ?? 0,
        parkingSpaces: ele?.parkingSpaces ?? 0,
        createdBy: (ele?.createdBy as any)?.name ?? null,
        status: ele?.status ?? null,
        createdAt: ele?.createdAt ?? null,
      }));

      return { colleges: response, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get course by id
  async getCollegeById(id: string): Promise<{ college: any }> {
    try {
      const college = await College.findById(id).populate("courseIds", "name");

      return { college };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to delete college by id
  async deleteCollegeById(
    id: string,
    status: boolean,
    staffId: string
  ): Promise<{ message: string }> {
    try {
      const currentTime = getCurrentISTTime();

      // NOTE: Update college status
      const college = await College.findByIdAndUpdate(id, {
        $set: { status, updatedBy: staffId, updatedAt: currentTime },
      });
      if (!college) throw new Error(RECORD_NOT_FOUND("College"));

      // NOTE: Find hostels related to this college
      const hostels = await Hostel.find({ universityId: id });

      //NOTE: If hotel found then update.
      if (hostels.length > 0) {
        const hostelIds = hostels.map((h) => h._id);

        // NOTE: Update hostels
        await Hostel.updateMany(
          { universityId: id },
          {
            $set: {
              status,
              updatedBy: staffId,
              updatedAt: currentTime,
            },
          }
        );

        // NOTE: Check if users exist for these hostels
        const userCount = await User.countDocuments({
          hostelId: { $in: hostelIds },
        });

        //NOTE: If user found then update.
        if (userCount > 0) {
          // NOTE: Update users related to hostels
          await User.updateMany(
            { hostelId: { $in: hostelIds } },
            {
              $set: {
                status,
                updatedBy: staffId,
                updatedAt: currentTime,
              },
            }
          );
        }
      }

      return {
        message: status ? COLLEGE_AND_RELATED_ENTITIES_ACTIVATED("College") : DELETE_DATA,
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to update a  college
  async updateCollegeById(
    id: string,
    totalCapacity: number,
    name: string,
    address: string,
    googleMapLink: string,
    location: { state: any; city: any; country: string },
    courseIds: string[],
    hostelDetails: {
      hostelType: HostelTypes;
      noOfBuildings: number;
      noOfBeds: number;
    }[],
    roomTypes: RoomTypes[],
    paymentTypes: BillingCycleTypes[],
    mealTypes: MealTypes[],
    evChargingStation: number,
    parkingSpaces: number,
    updatedBy: string,
    status?: boolean
  ): Promise<string> {
    try {
      // Check if another college with the same name exists, excluding the current college by id
      const existingCollege = await College.findOne({ _id: { $ne: id }, name });
      if (existingCollege)
        throw new Error(`College with the name '${name}' already exists.`);

      // Proceed with the update
      await College.findByIdAndUpdate(id, {
        $set: {
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
          updatedBy,
          updatedAt: getCurrentISTTime(),
        },
      });

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get all active  University
  async allUniversityWithoutPagination(): Promise<{ university: any[] }> {
    try {
      const university = await College.find({ status: true });
      //NOTE - send response
      const response = university.map((ele) => ({
        _id: ele._id,
        name: ele?.name ?? null,
        status: ele?.status ?? null,
      }));

      return { university: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async courseDetailsByUniversityId(
    universityId: string
  ): Promise<{ courses: any[] }> {
    try {
      const university: any = await College.findById(universityId)
        .select("courseIds")
        .populate("courseIds", "name status");

      if (!university) throw new Error(RECORD_NOT_FOUND("University"));

      const response =
        university.courseIds.map((ele: any) => ({
          _id: ele._id,
          name: ele?.name ?? null,
          status: ele?.status ?? null,
        })) ?? [];

      return { courses: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
}

export default new CollegeService();
