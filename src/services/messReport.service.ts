import mongoose from "mongoose";
import BookMeals from "../models/bookMeal.model";
import User from "../models/user.model";
import MessMenu from "../models/messMenu.model";
import { ERROR_MESSAGES, VALIDATION_MESSAGES } from "../utils/messages";
import {
  ExportTypes,
  MealBookingStatusTypes,
  MealConsumedType,
  MealCountReportType,
  ReportDropDownTypes,
  SortingTypes,
} from "../utils/enum";
import { getDateRange } from "../utils/lib";
const { RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { INVALID_REPORT_TYPE } = VALIDATION_MESSAGES;
import { getSignedUrl } from "../utils/awsUploadService";
import moment from "moment";
import StudentHostelAllocation from "../models/studentHostelAllocation.model";

class MessReportService {
  //SECTION Method to get meal bookings count based on status
  messDetailsCountReport = async (
    hostelId: string,
    status: ReportDropDownTypes,
    type: MealBookingStatusTypes
  ): Promise<{ report: any }> => {
    try {
      // If hostelId is provided, include it in the query
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

      // Get the date range based on status
      const { start, end } = getDateRange(status);

      // Count of active users who are verified, have status true, and are within the date range
      const activeUserCount = await User.countDocuments({
        isVerified: true,
        ...searchHostel,
        status: true,
      });

      let result: any = { activeUserCount };

      // Base query for meal bookings within the provided date range
      const baseMealQuery: any = {
        ...searchHostel,
        date: { $gte: new Date(start), $lte: new Date(end) },
        status: true,
      };

      // Modify `baseMealQuery` based on the `type` using a switch statement
      switch (type) {
        case MealBookingStatusTypes.BOOKED:
          baseMealQuery.bookingStatus = {
            $in: [
              MealBookingStatusTypes.BOOKED,
              MealBookingStatusTypes.PARTIALLY_BOOKED,
              MealBookingStatusTypes.PARTIALLY_CANCELLED,
            ],
          };
          break;
        case MealBookingStatusTypes.CANCELLED:
          baseMealQuery.bookingStatus = {
            $in: [
              MealBookingStatusTypes.CANCELLED,
              MealBookingStatusTypes.PARTIALLY_CANCELLED,
            ],
          };
          break;
        case MealBookingStatusTypes.GUEST_BOOKED:
          baseMealQuery.bookingStatus = MealBookingStatusTypes.GUEST_BOOKED;
          break;
        case MealBookingStatusTypes.NOT_BOOKED:
          baseMealQuery.isManualBooking = true;
          break;

        default:
          throw new Error(`Invalid meal booking status type: ${type}`);
      }

      // Aggregate for each meal type
      const mealTypes = [
        "isBreakfastBooked",
        "isLunchBooked",
        "isSnacksBooked",
        "isDinnerBooked",
      ];

      const mealCounts = await Promise.all(
        mealTypes.map(async (mealField) => {
          const mealCondition =
            type === MealBookingStatusTypes.CANCELLED ? false : true;

          const aggregation = await BookMeals.aggregate([
            { $match: { ...baseMealQuery, [mealField]: mealCondition } },
            { $group: { _id: "$studentId", totalBookings: { $sum: 1 } } },
            { $group: { _id: null, uniqueUsers: { $sum: 1 } } },
          ]);
          return aggregation[0]?.uniqueUsers || 0;
        })
      );

      console.log("mealCounts", mealCounts);

      result = {
        ...result,
        totalCount:
          mealCounts[0] + mealCounts[1] + mealCounts[2] + mealCounts[3],
        breakfastCount: mealCounts[0],
        lunchCount: mealCounts[1],
        snacksCount: mealCounts[2],
        dinnerCount: mealCounts[3],
      };

      return { report: result };
    } catch (error: any) {
      throw new Error(`${error.message}`);
    }
  };

  //SECTION Method to get meal Consumption List
  mealConsumptionList = async (
    hostelId: string,
    consumedType: MealConsumedType,
    durationType: ReportDropDownTypes
  ): Promise<{ report: any[] }> => {
    try {
      // If hostelId is provided, include it in the query
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

      // Get the date range based on the provided durationType
      const { start, end } = getDateRange(durationType);

      let report = [];

      if (consumedType === MealConsumedType.CONSUMPTION) {
        // Get students who have booked a meal (excluding canceled bookings)
        const bookMeal: any = await BookMeals.find({
          ...searchHostel,
          date: { $gte: start, $lte: end },
          bookingStatus: { $ne: MealBookingStatusTypes.CANCELLED },
        }).populate([{ path: "studentId", select: "name image uniqueId" }]);

        // Prepare the report from booked meals (ensure uniqueness)
        const uniqueBookedStudents = new Set();
        const reportPromises = bookMeal
          .filter((meal: any) => {
            // Ensure each student is added only once
            if (!uniqueBookedStudents.has(meal.studentId._id.toString())) {
              uniqueBookedStudents.add(meal.studentId._id.toString());
              return true;
            }
            return false;
          })
          .map(async (meal: any) => ({
            studentId: meal.studentId._id,
            uniqueId: meal.studentId.uniqueId,
            name: meal.studentId.name,
            image: meal.studentId.image
              ? await getSignedUrl(meal.studentId.image)
              : null,
          }));

        // Wait for all promises to resolve
        report = await Promise.all(reportPromises);
      } else if (consumedType === MealConsumedType.DEFAULTER) {
        // Get all active students of the hostel
        const allStudents: any[] = await User.find({
          ...searchHostel,
          isVerified: true,
        }).select("name image uniqueId");

        // Find students who have booked meals in the given date range
        const bookedStudentIds: any = await BookMeals.distinct("studentId", {
          ...searchHostel,
          date: { $gte: start, $lte: end },
          bookingStatus: { $ne: MealBookingStatusTypes.CANCELLED },
        });

        // Convert `bookedStudentIds` to strings for comparison
        const bookedStudentIdsSet = new Set(
          bookedStudentIds.map((id: { toString: () => any }) => id.toString())
        );

        // Filter students who have NOT booked any meals
        const defaulters = allStudents.filter(
          (student) => !bookedStudentIdsSet.has(student._id.toString())
        );

        // Prepare the report with defaulters (students who didn't book meals)
        const reportPromises = defaulters.map(async (student) => ({
          studentId: student._id,
          name: student.name,
          image: student.image ? await getSignedUrl(student.image) : null,
          uniqueId: student.uniqueId,
        }));

        // Wait for all promises to resolve
        report = await Promise.all(reportPromises);
      } else if (consumedType === MealConsumedType.CANCELLED) {
        // Get students who have booked a meal (excluding canceled bookings)
        const bookMeal: any = await BookMeals.find({
          ...searchHostel,
          date: { $gte: start, $lte: end },
          bookingStatus: MealBookingStatusTypes.CANCELLED,
        }).populate([{ path: "studentId", select: "name image uniqueId" }]);

        // Prepare the report from booked meals (ensure uniqueness)
        const uniqueBookedStudents = new Set();
        const reportPromises = bookMeal
          .filter((meal: any) => {
            // Ensure each student is added only once
            if (!uniqueBookedStudents.has(meal.studentId._id.toString())) {
              uniqueBookedStudents.add(meal.studentId._id.toString());
              return true;
            }
            return false;
          })
          .map(async (meal: any) => ({
            studentId: meal.studentId._id,
            name: meal.studentId.name,
            image: meal.studentId.image
              ? await getSignedUrl(meal.studentId.image)
              : null,
            uniqueId: meal.studentId.uniqueId,
          }));

        // Wait for all promises to resolve
        report = await Promise.all(reportPromises);
      }

      return { report };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION Method to get meal Consumption List export
  mealConsumptionListExport = async (
    hostelId: string,
    consumedType: MealConsumedType,
    durationType: ReportDropDownTypes
  ): Promise<{ report: any[]; headers: any }> => {
    try {
      // If hostelId is provided, include it in the query
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

      // Get the date range based on the provided durationType
      const { start, end } = getDateRange(durationType);

      let report = [];

      let headers: any;

      if (consumedType === MealConsumedType.CONSUMPTION) {
        // Get students who have booked a meal (excluding canceled bookings)
        const bookMeal: any = await BookMeals.find({
          ...searchHostel,
          date: { $gte: start, $lte: end },
          bookingStatus: { $ne: MealBookingStatusTypes.CANCELLED },
        }).populate([
          {
            path: "studentId",
            select: "name uniqueId gender hostelId",
            populate: [{ path: "hostelId", select: "name" }],
          },
        ]);

        // Prepare the report from booked meals (ensure uniqueness)
        const uniqueBookedStudents = new Set();
        const reportPromises = bookMeal
          .filter((meal: any) => {
            // Ensure each student is added only once
            if (!uniqueBookedStudents.has(meal.studentId._id.toString())) {
              uniqueBookedStudents.add(meal.studentId._id.toString());
              return true;
            }
            return false;
          })
          .map(async (meal: any) => {
            // Structure the report entry for each student and their meals
            const meals = {
              breakfast: meal?.isBreakfastBooked ? "Booked" : "Not Booked",
              lunch: meal?.isLunchBooked ? "Booked" : "Not Booked",
              dinner: meal?.isDinnerBooked ? "Booked" : "Not Booked",
              snacks: meal?.isSnacksBooked ? "Booked" : "Not Booked",
            };

            return {
              uniqueId: meal.studentId.uniqueId,
              name: meal.studentId.name,
              hostel: meal.studentId.hostelId.name,
              gender: meal.studentId.gender,
              date: meal.date, // Include the booking date
              ...meals,
            };
          });

        // Set dynamic headers based on meal consumption type
        headers = [
          { id: "uniqueId", title: "Unique ID" },
          { id: "name", title: "Student Name" },
          { id: "gender", title: "Gender" },
          { id: "hostel", title: "Hostel" },
          { id: "date", title: "Booking Date" },
          { id: "breakfast", title: "Breakfast" },
          { id: "lunch", title: "Lunch" },
          { id: "dinner", title: "Dinner" },
          { id: "snacks", title: "Snacks" },
        ];

        // Wait for all promises to resolve
        report = await Promise.all(reportPromises);
      } else if (consumedType === MealConsumedType.DEFAULTER) {
        // Get all active students of the hostel
        const allStudents: any[] = await User.find({
          ...searchHostel,
          isVerified: true,
        })
          .select("uniqueId name gender hostelId")
          .populate([{ path: "hostelId", select: "name" }]);

        // Find students who have booked meals in the given date range
        const bookedStudentIds: any = await BookMeals.distinct("studentId", {
          ...searchHostel,
          date: { $gte: start, $lte: end },
          bookingStatus: { $ne: MealBookingStatusTypes.CANCELLED },
        });

        // Convert `bookedStudentIds` to strings for comparison
        const bookedStudentIdsSet = new Set(
          bookedStudentIds.map((id: { toString: () => any }) => id.toString())
        );

        // Filter students who have NOT booked any meals
        const defaulters = allStudents.filter(
          (student) => !bookedStudentIdsSet.has(student._id.toString())
        );

        // Prepare the report with defaulters (students who didn't book meals)
        const reportPromises = defaulters.map(async (student) => ({
          name: student.name,
          gender: student?.gender ?? null,
          uniqueId: student.uniqueId,
          hostelName: student?.hostelId?.name,
        }));

        // Set dynamic headers for defaulters report
        headers = [
          { id: "uniqueId", title: "Unique ID" },
          { id: "name", title: "Student Name" },
          { id: "gender", title: "Gender" },
          { id: "hostelName", title: "Hostel Name" },
        ];

        // Wait for all promises to resolve
        report = await Promise.all(reportPromises);
      } else if (consumedType === MealConsumedType.CANCELLED) {
        // Get students who have booked a meal (excluding canceled bookings)
        const bookMeal: any = await BookMeals.find({
          ...searchHostel,
          date: { $gte: start, $lte: end },
          bookingStatus: MealBookingStatusTypes.CANCELLED,
        }).populate([{ path: "studentId", select: "name gender uniqueId" }]);

        // Prepare the report from booked meals (ensure uniqueness)
        const uniqueBookedStudents = new Set();
        const reportPromises = bookMeal
          .filter((meal: any) => {
            // Ensure each student is added only once
            if (!uniqueBookedStudents.has(meal.studentId._id.toString())) {
              uniqueBookedStudents.add(meal.studentId._id.toString());
              return true;
            }
            return false;
          })
          .map(async (meal: any) => ({
            name: meal.studentId.name,
            gender: meal.studentId.gender ?? null,
            uniqueId: meal.studentId.uniqueId,
            date: meal.date,
          }));

        // Set dynamic headers for cancelled meal report
        headers = [
          { id: "uniqueId", title: "Unique ID" },
          { id: "name", title: "Student Name" },
          { id: "gender", title: "Gender" },
          { id: "date", title: "Booking Date" },
        ];

        // Wait for all promises to resolve
        report = await Promise.all(reportPromises);
      }

      return { report, headers };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION Method to export book meal details
  exportBooKMealDetails = async (
    status: MealBookingStatusTypes,
    mealReportType: MealCountReportType,
    type: ExportTypes,
    search?: string,
    sort?: SortingTypes,
    hostelId?: string,
    floorNumber?: string,
    roomNumber?: string,
    startDate?: string,
    endDate?: string,
    bookMealIds?: string[]
  ): Promise<{ result: any[] }> => {
    try {
      const hostelSearch = hostelId ? { hostelId } : {};
      let searchParams: any = {};
      let searchUserParams: any = {};
      const sortOptions: any = {};

      switch (sort) {
        case SortingTypes.RECENT:
          sortOptions.date = -1;
          break;
        case SortingTypes.OLDEST:
          sortOptions.date = 1;
          break;
        case SortingTypes.CUSTOM:
          if (startDate && endDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            sortOptions.date = { $gte: start, $lte: end };
          } else {
            sortOptions.date = -1;
          }
          break;
        case SortingTypes.ASCENDING:
          sortOptions["studentId.name"] = 1;
          break;
        default:
          sortOptions.date = -1;
      }

      const mealConditions = {
        [MealCountReportType.BREAKFAST]: { isBreakfastBooked: true },
        [MealCountReportType.LUNCH]: { isLunchBooked: true },
        [MealCountReportType.DINNER]: { isDinnerBooked: true },
        [MealCountReportType.HI_TEA]: { isSnacksBooked: true },
        [MealCountReportType.FULL_DAY]: {
          isBreakfastBooked: true,
          isLunchBooked: true,
          isDinnerBooked: true,
          isSnacksBooked: true,
        },
      };

      switch (status) {
        case MealBookingStatusTypes.BOOKED:
        case MealBookingStatusTypes.CANCELLED:
          const statusParams =
            status === MealBookingStatusTypes.BOOKED
              ? [
                MealBookingStatusTypes.BOOKED,
                MealBookingStatusTypes.PARTIALLY_BOOKED,
                MealBookingStatusTypes.PARTIALLY_CANCELLED,
              ]
              : [
                MealBookingStatusTypes.CANCELLED,
                MealBookingStatusTypes.PARTIALLY_CANCELLED,
              ];

          searchParams.bookingStatus = { $in: statusParams };

          if (mealReportType !== MealCountReportType.ALL) {
            const condition = mealConditions[mealReportType];
            if (condition) {
              Object.assign(searchParams, condition);
            } else {
              throw new Error(INVALID_REPORT_TYPE("Meal Report"));
            }
          }
          break;

        case MealBookingStatusTypes.SKIPPED:
          return { result: [] };
      }

      let userIds: mongoose.Types.ObjectId[] = [];

      // Search by user name
      if (search) {
        const matchingStudentIds: any = await User.find({
          name: { $regex: `^${search}`, $options: "i" },
        }).select("_id");

        if (matchingStudentIds.length > 0) {
          userIds = matchingStudentIds.map((entry:any) => entry._id);
        }
      }

      // Filtering by floor number or room number
      if (floorNumber || roomNumber) {
        const allocationQuery: any = {
          hostelId: new mongoose.Types.ObjectId(hostelId),
        };
        if (floorNumber) allocationQuery.floorNumber = Number(floorNumber);
        if (roomNumber) allocationQuery.roomNumber = Number(roomNumber);

        const allocatedUsers = await StudentHostelAllocation.find(
          allocationQuery
        ).select("studentId");
        userIds = allocatedUsers.map((entry) => entry.studentId);
      }

      if ((search || floorNumber || roomNumber) && userIds) {
        searchUserParams.studentId = {
          $in: userIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }

     
      const query: any =
        type === ExportTypes.ALL
          ? { ...searchParams, ...searchUserParams, ...hostelSearch }
          : { _id: { $in: bookMealIds } };

      const bookMeal = await BookMeals.find(query)
        .populate([
          { path: "studentId", select: "name email phone uniqueId image" },
          { path: "hostelId", select: "name" },
        ])
        .sort(sortOptions)
        .lean()
        .select("-__v -createdBy -updatedBy");
      if (!bookMeal || bookMeal.length === 0) {
        throw new Error(
          RECORD_NOT_FOUND(
            type === ExportTypes.ALL ? "Book Meals" : "Book Meal"
          )
        );
      }

      const result = await Promise.all(
        bookMeal.map(async (meal: any) => {
          const mealTypes: string[] = [];
          if (meal.isBreakfastBooked) mealTypes.push("Breakfast");
          if (meal.isLunchBooked) mealTypes.push("Lunch");
          if (meal.isDinnerBooked) mealTypes.push("Dinner");
          if (meal.isSnacksBooked) mealTypes.push("Hi-Tea");

          const studentHostelData: any = await StudentHostelAllocation.findOne({
            studentId: meal.studentId?._id,
            hostelId: meal?.hostelId,
          });

          return {
            bookMealNumber: meal?.bookMealNumber,
            studentName: meal?.studentId?.name,
            hostel: meal?.hostelId?.name,
            date: moment(meal?.date).format("YYYY-MM-DD"),
            isBreakfastBooked: meal?.isBreakfastBooked,
            isLunchBooked: meal?.isLunchBooked,
            isDinnerBooked: meal?.isDinnerBooked,
            isSnacksBooked: meal?.isSnacksBooked,
            mealType: mealTypes.join(", ") || null,
            cancellationReason: meal?.cancellationReason,
            bookedOn: moment(meal?.createdAt).format("YYYY-MM-DD"),
            bookingStatus: meal?.bookingStatus,
            floorNumber: studentHostelData?.floorNumber ?? null,
            roomNumber: studentHostelData?.roomNumber ?? null,
          };
        })
      );

      return { result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION Method to export mess menu details
  exportMessMenuDetails = async (
    hostelId: string,
    type: ExportTypes,
    mealType: MealCountReportType,
    sort?: SortingTypes,
    startDate?: string,
    endDate?: string,
    messMenuIds?: string[]
  ): Promise<{ result: any }> => {
    try {
      const searchParams: any =
        type === ExportTypes.ALL ? { hostelId } : { _id: { $in: messMenuIds } };

      const sortOptions: any = {};
      switch (sort) {
        case SortingTypes.RECENT:
          sortOptions.date = -1;
          break;
        case SortingTypes.OLDEST:
          sortOptions.date = 1;
          break;
        case SortingTypes.CUSTOM:
          if (startDate && endDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);

            searchParams.date = {
              $gte: start,
              $lte: end,
            };
          } else {
            sortOptions.date = -1;
          }
          break;
        default:
          sortOptions.date = -1;
      }
      const messMenu = await MessMenu.find(searchParams)
        .populate([
          { path: "hostelId", select: "name" },
          { path: "createdBy", select: "name" },
          { path: "updatedBy", select: "name" },
        ])
        .sort(sortOptions)
        .lean();

      if (!messMenu || messMenu.length === 0) {
        throw new Error(
          RECORD_NOT_FOUND(
            type === ExportTypes.ALL ? "Mess Menus" : "Mess Menu"
          )
        );
      }

      const result = messMenu.map((menu: any) => ({
        hostel: menu?.hostelId?.name,
        date: moment(menu?.date).format("YYYY-MM-DD"),
        breakfast:
          mealType === MealCountReportType.ALL || mealType === MealCountReportType.BREAKFAST
            ? menu.breakfast ?? null
            : null,
        lunch:
          mealType === MealCountReportType.ALL || mealType === MealCountReportType.LUNCH
            ? menu.lunch ?? null
            : null,
        dinner:
          mealType === MealCountReportType.ALL || mealType === MealCountReportType.DINNER
            ? menu.dinner ?? null
            : null,
        snacks:
          mealType === MealCountReportType.ALL || mealType === MealCountReportType.HI_TEA
            ? menu.snacks ?? null
            : null,
        createdBy: menu?.createdBy?.name,
        updatedBy: menu?.updatedBy?.name,
      }));

      return { result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };


  //SECTION Method to export missed booking user details
  exportMissedBookingDetails = async (
    type: ExportTypes,
    mealReportType: MealCountReportType,
    missedBookingIds?: string[],
    sort?: SortingTypes,
    hostelId?: string,
    startDate?: string,
    endDate?: string,
    floorNumber?: string,
    roomNumber?: string
  ): Promise<{ result: any[] }> => {
    try {
      // Reusing logic from fetchManuallyBookedMeals
      const hostelSearch = hostelId ? { hostelId } : {};
      let searchUserParams: any = {};
      let searchParams: any = {};

      let userIds: mongoose.Types.ObjectId[] = [];

      const sortOptions: any = {};
      switch (sort) {
        case SortingTypes.RECENT:
          sortOptions.date = -1;
          break;
        case SortingTypes.OLDEST:
          sortOptions.date = 1;
          break;
        case SortingTypes.CUSTOM:
          if (startDate && endDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);

            searchParams.date = {
              $gte: start,
              $lte: end,
            };
          } else {
            sortOptions.date = -1;
          }
          break;
        case SortingTypes.ASCENDING:
          sortOptions["studentId.name"] = 1;
          break;
        default:
          sortOptions.date = -1;
      }

      const mealConditions = {
        [MealCountReportType.BREAKFAST]: { isBreakfastBooked: true },
        [MealCountReportType.LUNCH]: { isLunchBooked: true },
        [MealCountReportType.DINNER]: { isDinnerBooked: true },
        [MealCountReportType.HI_TEA]: { isSnacksBooked: true },
        [MealCountReportType.FULL_DAY]: {
          isBreakfastBooked: true,
          isLunchBooked: true,
          isDinnerBooked: true,
          isSnacksBooked: true,
        },
        [MealCountReportType.ALL]: {},
      };

      // Filtering by floor number or room number
      if (floorNumber || roomNumber) {
        const allocationQuery: any = {
          hostelId: new mongoose.Types.ObjectId(hostelId),
        };
        if (floorNumber) allocationQuery.floorNumber = Number(floorNumber);
        if (roomNumber) allocationQuery.roomNumber = Number(roomNumber);

        const allocatedUsers = await StudentHostelAllocation.find(
          allocationQuery
        ).select("studentId");
        userIds = allocatedUsers.map((entry) => entry.studentId);
      }

      if ((floorNumber || roomNumber) && userIds.length) {
        searchUserParams.studentId = {
          $in: userIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }

      const query: any =
        type === ExportTypes.ALL
          ? {
            isManualBooking: true,
            ...searchUserParams,
            ...hostelSearch,
            ...searchParams,
            ...mealConditions[mealReportType],
          }
          : { _id: { $in: missedBookingIds } };

      const bookMealDetails = await BookMeals.find(query)
        .populate([
          { path: "hostelId", select: "name" },
          { path: "studentId", select: "name email phone uniqueId" },
        ])
        .sort(sortOptions)
        .lean();

      const result = await Promise.all(
        bookMealDetails.map(async (meal: any) => {
          let mealTypes: string[] = [];

          if (
            mealReportType === MealCountReportType.ALL &&
            meal.isBreakfastBooked &&
            meal.isLunchBooked &&
            meal.isDinnerBooked &&
            meal.isSnacksBooked
          ) {
            mealTypes = ["Breakfast", "Lunch", "Dinner", "Hi-Tea"];
          } else {
            if (
              mealReportType === MealCountReportType.BREAKFAST &&
              meal.isBreakfastBooked
            ) {
              mealTypes.push("Breakfast");
            }
            if (
              mealReportType === MealCountReportType.LUNCH &&
              meal.isLunchBooked
            ) {
              mealTypes.push("Lunch");
            }
            if (
              mealReportType === MealCountReportType.DINNER &&
              meal.isDinnerBooked
            ) {
              mealTypes.push("Dinner");
            }
            if (
              mealReportType === MealCountReportType.HI_TEA &&
              meal.isSnacksBooked
            ) {
              mealTypes.push("Hi-Tea");
            }
            if (mealReportType === MealCountReportType.FULL_DAY) {
              if (meal.isBreakfastBooked) mealTypes.push("Breakfast");
              if (meal.isLunchBooked) mealTypes.push("Lunch");
              if (meal.isDinnerBooked) mealTypes.push("Dinner");
              if (meal.isSnacksBooked) mealTypes.push("Hi-Tea");
            }
          }

          const studentHostelData: any = await StudentHostelAllocation.findOne({
            studentId: meal.studentId?._id,
            hostelId: meal?.hostelId,
          });

          return {
            hostel: meal?.hostelId?.name ?? null,
            bookMealNumber: meal?.bookMealNumber ?? null,
            uniqueId: meal?.studentId?.uniqueId ?? null,
            name: meal.studentId?.name ?? null,
            email: meal.studentId?.email ?? null,
            phone: meal.studentId?.phone ?? null,
            date: moment(meal?.date).format("YYYY-MM-DD"),
            mealType:
              mealReportType === MealCountReportType.ALL
                ? mealTypes
                : mealTypes.join(", ") || null,
            floorNumber: studentHostelData?.floorNumber ?? null,
            roomNumber: studentHostelData?.roomNumber ?? null,
            bookedOn: moment(meal?.createdAt).format("YYYY-MM-DD"),
          };
        })
      );

      return { result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };
}

export default new MessReportService();
