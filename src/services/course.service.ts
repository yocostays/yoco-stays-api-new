import Course from "../models/course.model";
import { getCurrentISTTime } from "../utils/lib";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "../utils/messages";

const { CREATE_DATA, UPDATE_DATA, DELETE_DATA } = SUCCESS_MESSAGES;
const { RECORD_NOT_FOUND } = ERROR_MESSAGES;

class CourseService {
  //SECTION: Method to create a new course
  async createNewCourse(name: string, staffId: string): Promise<string> {
    try {
      // Check if a course with the same name already exists
      const existingCourse = await Course.findOne({ name });
      if (existingCourse)
        throw new Error(`Course with the name '${name}' already exists.`);

      await Course.create({
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

  //SECTION: Method to get all course
  async getAllCoursesWithPagination(
    page: number,
    limit: number,
    search?: string
  ): Promise<{ courses: any[]; count: number }> {
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
        Course.find(query)
          .populate([{ path: "createdBy", select: "name" }])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Course.countDocuments(query),
      ]);

      //NOTE - send response
      const response = courses.map((ele) => ({
        _id: ele._id,
        name: ele?.name ?? null,
        createdBy: (ele?.createdBy as any)?.name ?? null,
        createdAt: ele?.createdAt ?? null,
      }));

      return { courses: response, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get course by id
  async getCourseById(id: string): Promise<{ course: any }> {
    try {
      const course = await Course.findById(id);

      return { course };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get course by name
  async getCourseByName(name: string): Promise<{ course: any }> {
    try {
      // Run both queries in parallel
      const course = await Course.findOne({ name });

      return { course };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to update a new course
  async updateCourseDetails(
    id: string,
    name: string,
    staffId: string,
    status?: boolean
  ): Promise<any> {
    try {
      // Check if a course with the same name already exists
      const existingCourse = await Course.findOne({ _id: { $ne: id }, name });
      if (existingCourse) {
        throw new Error(`Course with the name '${name}' already exists.`);
      }

      //NOTE - update course
      await Course.findByIdAndUpdate(id, {
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

  //SECTION: Method to delete course by id
  async deleteCourseById(id: string): Promise<string> {
    try {
      // Run both queries in parallel
      const course = await Course.findByIdAndDelete(id);

      if (!course) throw new Error(RECORD_NOT_FOUND("Course"));

      return DELETE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
}

export default new CourseService();
