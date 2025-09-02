import mongoose from "mongoose";
import User from "../models/user.model";
import Staff from "../models/staff.model";
import Role from "../models/role.model";
import moment from "moment";
import { ExportTypes, ReportDropDownTypes } from "../utils/enum";
import { getDateRange } from "../utils/lib";
import { ERROR_MESSAGES } from "../utils/messages";

const { RECORD_NOT_FOUND } = ERROR_MESSAGES;

class UserReportService {
  //SECTION: Method to get user count report
  userCountReport = async (hostelId: string): Promise<{ report: any }> => {
    try {
      // Exclude admin and super admin roles
      const roles = await Role.find({
        name: { $regex: /^(?!.*(?:admin|super\s?admin)).*$/i },
      }).select("_id");

      if (!roles.length) throw new Error(RECORD_NOT_FOUND("Role"));

      // Construct search criteria for hostel-specific queries
      const searchHostel = hostelId
        ? { hostelId: new mongoose.Types.ObjectId(hostelId) }
        : {};

      // Fetch student counts
      const [activeUserCount, inActiveUserCount] = await Promise.all([
        User.countDocuments({
          isVerified: true,
          ...searchHostel,
          status: true,
        }),
        User.countDocuments({
          isVerified: true,
          ...searchHostel,
          status: false,
        }),
      ]);

      // Fetch staff counts
      const staffQuery = {
        roleId: { $in: roles.map((role) => role._id) },
        ...(hostelId && {
          hostelIds: { $in: [new mongoose.Types.ObjectId(hostelId)] },
        }),
      };
      const [activeStaffCount, inActiveStaffCount] = await Promise.all([
        Staff.countDocuments({ ...staffQuery, status: true }),
        Staff.countDocuments({ ...staffQuery, status: false }),
      ]);

      // Fetch admin role
      const adminRole = await Role.find({
        $and: [
          { name: { $regex: /admin/i } },
          { name: { $not: { $regex: /super admin/i } } },
        ],
      });
      if (!adminRole) throw new Error(RECORD_NOT_FOUND("Admin Role"));

      const adminQuery = {
        roleId: { $in: adminRole.map((r) => r._id) },
        ...(hostelId && {
          hostelIds: { $in: [new mongoose.Types.ObjectId(hostelId)] },
        }),
      };
      const [activeAdminCount, inActiveAdminCount] = await Promise.all([
        Staff.countDocuments({ ...adminQuery, status: true }),
        Staff.countDocuments({ ...adminQuery, status: false }),
      ]);

      // Construct the final report
      const result = {
        student: {
          totalStudentCount: activeUserCount + inActiveUserCount,
          activeUserCount,
          inActiveUserCount,
        },
        staff: {
          totalStaffCount: activeStaffCount + inActiveStaffCount,
          activeStaffCount,
          inActiveStaffCount,
        },
        admin: {
          totalAdminCount: activeAdminCount + inActiveAdminCount,
          activeAdminCount,
          inActiveAdminCount,
        },
      };

      return { report: result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get stuent and staff count report
  totalStudentAndStaffCount = async (
    hostelId: string,
    dateRange?: ReportDropDownTypes
  ): Promise<{ report: any }> => {
    try {
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId); // Convert hostelId to ObjectId
      }
      // Initialize search parameters for students
      const searchParams: any = {};
      // Initialize search parameters for staff
      const searchStaffParams: any = {};

      // Get date range from dateRange and apply to both student and staff params
      if (dateRange) {
        const { start, end } = getDateRange(dateRange);
        if (start && end) {
          searchParams.createdAt = {
            $gte: new Date(start),
            $lte: new Date(end),
          };
          searchStaffParams.joiningDate = {
            $gte: new Date(start),
            $lte: new Date(end),
          };
        }
      }
      // Run both queries in parallel to get the counts
      const [activeUserCount, staffCount] = await Promise.all([
        // Count of active users who are verified and have status true
        User.countDocuments({
          isVerified: true,
          ...searchHostel,
          ...searchParams,
          status: true,
        }),

        // Count of staff who have the specified hostel id assigned
        Staff.countDocuments({
          hostelIds: { $in: [new mongoose.Types.ObjectId(hostelId)] },
          ...searchStaffParams,
          status: true,
        }),
      ]);

      // Structure the result as an array of objects
      const result = [
        { label: "Student", value: activeUserCount },
        { label: "Staff", value: staffCount },
      ];

      // Return the result in the desired format
      return { report: result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get a new student
  exportStudentDetails = async (
    hostelId: string,
    type: ExportTypes,
    studentIds?: string[]
  ): Promise<{ result: any[] }> => {
    try {
      // Build query based on the type
      const query: any =
        type === ExportTypes.ALL ? { hostelId } : { _id: { $in: studentIds } };

      // Execute the query and select the necessary fields
      const student = await User.find(query)
        .populate([
          { path: "roleId", select: "name" },
          { path: "academicDetails.universityId", select: "name" },
          { path: "academicDetails.courseId", select: "name" },
          { path: "hostelId", select: "name" },
          { path: "verifiedBy", select: "name" },
        ])
        .lean()
        .select("-password -createdBy -updatedBy -image");

      if (!student || student.length === 0) {
        throw new Error(
          RECORD_NOT_FOUND(type === ExportTypes.ALL ? "Students" : "Student")
        );
      }

      const result = student.map((student: any) => {
        const flattenedVehicleDetails: any = {};

        student?.vechicleDetails?.forEach((vehicle: any, index: number) => {
          flattenedVehicleDetails[`vehicleDetails.${index}.vehicleType`] = vehicle?.vechicleType ?? null;
          flattenedVehicleDetails[`vehicleDetails.${index}.engineType`] = vehicle?.engineType ?? null;
          flattenedVehicleDetails[`vehicleDetails.${index}.vehicleNumber`] = vehicle?.vechicleNumber ?? null;
          flattenedVehicleDetails[`vehicleDetails.${index}.modelName`] = vehicle?.modelName ?? null;
        });
        return {
          // Flatten and format top-level fields
          uniqueId: student?.uniqueId,
          roleName: student?.roleId?.name,
          name: student?.name,
          phone: student?.phone,
          email: student?.email,
          dob: moment(student?.dob).format("YYYY-MM-DD"),
          enrollmentNumber: student?.enrollmentNumber,
          bloodGroup: student?.bloodGroup,
          divyang: student?.divyang,
          gender: student?.gender,
          identificationMark: student?.identificationMark,
          medicalIssue: student?.medicalIssue,
          allergyProblem: student?.allergyProblem,
          category: student?.category,
          cast: student?.cast,
          permanentAddress: student?.permanentAddress,
          currentAddress: student?.currentAddress,

          // Format familyDetails object
          fatherName: student?.familiyDetails?.fatherName,
          fatherNumber: student?.familiyDetails?.fatherNumber,
          fatherEmail: student?.familiyDetails?.fatherEmail,
          fatherOccuption: student?.familiyDetails?.fatherOccuption,
          motherName: student?.familiyDetails?.motherName,
          motherNumber: student?.familiyDetails?.motherNumber,
          motherEmail: student?.familiyDetails?.motherEmail,
          guardianName: student?.familiyDetails?.guardianName,
          guardianContactNo: student?.familiyDetails?.guardianContactNo,
          relationship: student?.familiyDetails?.relationship,
          occuption: student?.familiyDetails?.occuption,
          guardianEmail: student?.familiyDetails?.guardianEmail,
          guardianAddress: student?.familiyDetails?.address,

          // Format country object
          countryName: student?.country?.name,

          //Format state object
          stateName: student?.state?.name,

          //Formate city object
          cityName: student?.city?.name,

          // Format academicDetails object
          universityName: student?.academicDetails?.universityId?.name,
          courseName: student?.academicDetails?.courseId?.name,
          academicYear: student?.academicDetails?.academicYear,
          semester: student?.academicDetails?.semester,

          // Format documents object
          aadhaarCard: student?.documents?.aadhaarCard,
          voterCard: student?.documents?.voterCard,
          passport: student?.documents?.passport,
          drivingLicense: student?.documents?.drivingLicense,
          panCard: student?.documents?.panCard,

          // Format hostel details
          hostelName: student?.hostelId?.name,
          isVerified: student?.isVerified,
          verifiedBy: student?.verifiedBy?.name,
          isAuthorized: student?.isAuthorized,
          authorizRole: student?.authorizRole,

          // Flattened vehicle details
          ...flattenedVehicleDetails,
        }

      });

      return { result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };
}

export default new UserReportService();
