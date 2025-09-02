import Amenitie from "../models/amenities.model";
import { getCurrentISTTime } from "../utils/lib";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "../utils/messages";

const { CREATE_DATA, UPDATE_DATA, DELETE_DATA } = SUCCESS_MESSAGES;
const { RECORD_NOT_FOUND } = ERROR_MESSAGES;

class AmenitiesService {
  //SECTION: Method to create a new amenitie
  async createNewAmenities(name: string, staffId: string): Promise<string> {
    try {
      // Check if a amenitie with the same name already exists
      const existingCourse = await Amenitie.findOne({ name });
      if (existingCourse)
        throw new Error(`Amenitie with the name '${name}' already exists.`);

      await Amenitie.create({
        name,
        createdBy: staffId,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get all Amenitie
  async getAllAmenitiesWithPagination(
    page: number,
    limit: number,
    search?: string
  ): Promise<{ amenities: any[]; count: number }> {
    try {
      // Calculate the number of documents to skip
      const skip = (page - 1) * limit;

      // Build the query for searching course
      const query: { name?: { $regex: RegExp } } = {};
      if (search) {
        query.name = { $regex: new RegExp(`\\b${search}\\b`, "i") };
      }

      // Run both queries in parallel
      const [amenities, count] = await Promise.all([
        Amenitie.find(query)
          .populate([{ path: "createdBy", select: "name" }])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Amenitie.countDocuments(query),
      ]);

      //NOTE - send response
      const response = amenities.map((ele) => ({
        _id: ele._id,
        name: ele?.name ?? null,
        createdBy: (ele?.createdBy as any)?.name ?? null,
        createdAt: ele?.createdAt ?? null,
      }));

      return { amenities: response, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get amenities by id
  async getAmenitieById(id: string): Promise<{ amenitie: any }> {
    try {
      const amenitie = await Amenitie.findById(id);

      return { amenitie };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get amenities by name
  async getAmenitieByName(name: string): Promise<{ course: any }> {
    try {
      // Run both queries in parallel
      const course = await Amenitie.findOne({ name });

      return { course };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to update a new amenitie
  async updateAmenitieDetails(
    id: string,
    name: string,
    staffId: string,
    status?: boolean
  ): Promise<any> {
    try {
      // Check if a amenitie with the same name already exists
      const existingAmenitie = await Amenitie.findOne({ _id: { $ne: id }, name });
      if (existingAmenitie)
        throw new Error(`Amenitie with the name '${name}' already exists.`);

      //NOTE - update amenitie
      await Amenitie.findByIdAndUpdate(id, {
        $set: {
          name,
          updatedBy: staffId,
          status: status ? status : true,
          updatedAt: getCurrentISTTime(),
        },
      });

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to delete amenitie by id
  async deleteAmenitieById(id: string): Promise<string> {
    try {
      const amenitie = await Amenitie.findByIdAndDelete(id);

      if (!amenitie) throw new Error(RECORD_NOT_FOUND("Amenitie"));

      return DELETE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
}

export default new AmenitiesService();
