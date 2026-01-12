import mongoose, { PipelineStage, Types } from "mongoose";
import { normalizeDateKey } from "../utils/dateUtils";
import moment from "moment-timezone"; // Keeping moment as per existing imports, but avoiding usage in optimized function
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
import { formatDateOnly, getDateRange, populateTemplate } from "../utils/lib";
import MessMenu from "../models/messMenu.model";
import BulkUpload from "../models/bulkUpload.model";
import Hostel from "../models/hostel.model";
import BookMeals, { IBookMealsDetails } from "../models/bookMeal.model";
import User from "../models/user.model";
import Notice from "../models/notice.model";
import StudentHostelAllocation from "../models/studentHostelAllocation.model";
import HostelMealTiming from "../models/hostelMealTiming.model";
import { getSignedUrl, pushToS3Bucket } from "../utils/awsUploadService";
import { MESS_BULK_UPLOAD_FILES } from "../utils/s3bucketFolder";
import UserService from "./user.service";
import HostelPolicy from "../models/hostelPolicy.model";
import StudentLeave from "../models/student-leave.model";
import { paginateAggregate } from "../utils/pagination";
import FoodWastage from "../models/foodWastage.model";
import { WardenMealReportingInput } from "../utils/validators/wardenMealReporting.validator";

import {
  excelDateToJSDate,
  getCurrentISTTime,
  getDatesBetween,
  getDayOfWeek,
  getMealDetails,
  getMonthDateRange,
  groupDataByDate,
} from "../utils/lib";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";
import {
  MealBookingStatusTypes,
  ReportDropDownTypes,
  MealCountReportType,
  SortingTypes,
  BulkUploadTypes,
  TemplateTypes,
  NoticeTypes,
  PushNotificationTypes,
  LeaveStatusTypes,
  MealBookingIntent,
  MealCancelSource,
  MealDerivedStatus,
} from "../utils/enum";
import { sendPushNotificationToUser } from "../utils/commonService/pushNotificationService";

const { RECORD_NOT_FOUND, START_DATE_ERROR, NO_DATA_IN_GIVEN_DATE } =
  ERROR_MESSAGES;
const { CREATE_DATA, DELETE_DATA, UPDATE_DATA, MEAL_CANCELLED } =
  SUCCESS_MESSAGES;
const { MESS_MENU_ALREADY_EXIST, INVALID_REPORT_TYPE } = VALIDATION_MESSAGES;
const { fetchPlayerNotificationConfig, getStudentAllocatedHostelDetails } =
  UserService;

interface TodayMenuResponse {
  messDetails: {
    date: Date;
    breakfast: string;
    lunch: string;
    snacks: string;
    dinner: string;
  };
}

class MessService {
  //SECTION: Method to create a mess menu for hostel
  messMenuCreationForHostel = async (
    hostelId: string,
    fromDate: Date | string,
    breakfast: string,
    lunch: string,
    snacks: string,
    dinner: string,
    createdById?: string
  ): Promise<string> => {
    try {
      const targetDate = dayjs.utc(fromDate).startOf("day");
      const today = dayjs.utc().startOf("day");

      if (targetDate.isBefore(today)) {
        throw new Error(START_DATE_ERROR);
      }

      const existingHostel = await Hostel.exists({ _id: hostelId });
      if (!existingHostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      const normalizedDate = targetDate.toDate();
      const dayOfWeek = targetDate.format("dddd").toLowerCase();

      // Prepare the data to be inserted or updated
      const updateData = {
        breakfast,
        lunch,
        snacks,
        dinner,
        day: dayOfWeek,
        updatedBy: createdById,
        updatedAt: getCurrentISTTime(),
      };

      const existingRecord = await MessMenu.findOne({
        hostelId,
        date: normalizedDate,
      });

      if (existingRecord) {
        await MessMenu.updateOne(
          { _id: existingRecord._id },
          { $set: updateData }
        );
      } else {
        const uniqueId = await this.generateMessMenuUniqueId();
        const newMenu = new MessMenu({
          ...updateData,
          uniqueId,
          hostelId,
          date: normalizedDate,
          createdBy: createdById,
          createdAt: getCurrentISTTime(),
        });
        await newMenu.save();
      }

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get all mess menu
  messMenuWithPagination = async (
    page: number = 1,
    limit: number = 10,
    hostelId?: string,
    sort?: SortingTypes | string,
    startDate?: string,
    endDate?: string,
    onlyWithWastage: boolean = false
  ): Promise<{ count: number; data: any[] }> => {
    try {
      // Service-Level Input Validation
      if (hostelId && !Types.ObjectId.isValid(hostelId)) {
        throw new Error(VALIDATION_MESSAGES.INVALID_ID);
      }

      const matchStage: Record<string, any> = {};

      if (hostelId) {
        matchStage.hostelId = new Types.ObjectId(hostelId);
      }

      //  Date Range Handling (Shifted by -6h to capture IST-Midnight stored as 18:30 UTC)
      if (startDate && endDate) {
        const start = dayjs(startDate)
          .startOf("day")
          .subtract(6, "hours")
          .toDate();
        const end = dayjs(endDate).endOf("day").subtract(6, "hours").toDate();

        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          matchStage.date = { $gte: start, $lte: end };
        }
      }

      const sortStage: Record<string, 1 | -1> = {};

      // Default to DESCENDING (Recent First) for general listing.
      const sortValue = typeof sort === "string" ? sort.toUpperCase() : sort;
      const isChronological =
        sortValue === SortingTypes.OLDEST ||
        sortValue === "OLDEST" ||
        sortValue === SortingTypes.ASCENDING ||
        sortValue === "ASCENDING" ||
        (startDate && endDate && !sort);

      if (isChronological) {
        sortStage.date = 1;
      } else {
        sortStage.date = -1;
      }

      const pipeline: PipelineStage[] = [
        { $match: matchStage },
        { $sort: sortStage },
        {
          $lookup: {
            from: "foodwastages",
            localField: "_id",
            foreignField: "mealIds",
            as: "wastageData",
          },
        },
        // Optimization: Filter for records with wastage if requested
        ...(onlyWithWastage
          ? [{ $match: { "wastageData.0": { $exists: true } } }]
          : []),
        {
          $addFields: {
            wastage: { $arrayElemAt: ["$wastageData", 0] },
          },
        },
        {
          $project: {
            _id: 0,
            uniqueId: 1,
            foodWastageNumber: {
              $ifNull: ["$wastage.foodWastageNumber", null],
            },
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            wastage: {
              $cond: {
                if: { $gt: [{ $ifNull: ["$wastage.totalWastage", 0] }, 0] },
                then: {
                  $concat: [
                    { $toString: "$wastage.totalWastage" },
                    " ",
                    "$wastage.totalUnit",
                  ],
                },
                else: null,
              },
            },
            feedback: null,
            meals: {
              breakfast: {
                name: {
                  $cond: {
                    if: {
                      $or: [
                        { $eq: ["$breakfast", "-"] },
                        { $not: "$breakfast" },
                      ],
                    },
                    then: null,
                    else: "$breakfast",
                  },
                },
                wastage: { $ifNull: ["$wastage.breakfast", null] },
                feedback: null,
              },
              lunch: {
                name: {
                  $cond: {
                    if: { $or: [{ $eq: ["$lunch", "-"] }, { $not: "$lunch" }] },
                    then: null,
                    else: "$lunch",
                  },
                },
                wastage: { $ifNull: ["$wastage.lunch", null] },
                feedback: null,
              },
              snacks: {
                name: {
                  $cond: {
                    if: {
                      $or: [{ $eq: ["$snacks", "-"] }, { $not: "$snacks" }],
                    },
                    then: null,
                    else: "$snacks",
                  },
                },
                wastage: { $ifNull: ["$wastage.snacks", null] },
                feedback: null,
              },
              dinner: {
                name: {
                  $cond: {
                    if: {
                      $or: [{ $eq: ["$dinner", "-"] }, { $not: "$dinner" }],
                    },
                    then: null,
                    else: "$dinner",
                  },
                },
                wastage: { $ifNull: ["$wastage.dinner", null] },
                feedback: null,
              },
            },
          },
        },
      ];

      const { data, count } = await paginateAggregate(
        MessMenu,
        pipeline,
        page,
        limit
      );

      return { count, data: data || [] };
    } catch (error: any) {
      throw error;
    }
  };

  //SECTION: Method to get mess menu by id
  hostelMessManuById = async (id: string): Promise<{ messDetails: any }> => {
    try {
      const mess = await MessMenu.findById(id).select(
        "-createdAt -updatedAt -createdBy -updatedBy -__v"
      );

      if (!mess) throw new Error(RECORD_NOT_FOUND("Menu"));

      return { messDetails: mess };
    } catch (error: any) {
      throw new Error(`Failed to retrieve menu: ${error.message}`);
    }
  };

  //SECTION: Method to delete mess menu by id
  deleteMenuById = async (messId: string[]): Promise<string> => {
    try {
      const deleteData = await MessMenu.deleteMany({ _id: { $in: messId } });

      if (deleteData.deletedCount === 0)
        throw new Error(RECORD_NOT_FOUND("Mess menu"));

      return DELETE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to update a mess menu for hostel
  updateHostelMessMenuById = async (
    id: string,
    hostelId: string,
    date: Date,
    breakfast: string,
    lunch: string,
    snacks: string,
    dinner: string,
    createdById?: string
  ): Promise<string> => {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Convert date to UTC midnight to avoid time zone issues
      const normalizedDate = new Date(date);
      normalizedDate.setUTCHours(0, 0, 0, 0);

      if (normalizedDate < today) throw new Error(START_DATE_ERROR);

      // Check if the hostel exists
      const existingHostel = await Hostel.exists({ _id: hostelId });
      if (!existingHostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      // Check if the mess menu with the given id exists
      const existingMenu: any = await MessMenu.findById(id);
      if (!existingMenu) {
        throw new Error(RECORD_NOT_FOUND("Mess Menu"));
      }

      // Check if there is another mess menu record for the same hostel and date
      const duplicateMenu = await MessMenu.findOne({
        hostelId,
        date: normalizedDate,
        _id: { $ne: id },
      });

      if (duplicateMenu) throw new Error(MESS_MENU_ALREADY_EXIST);

      const dayOfWeek = getDayOfWeek(normalizedDate);

      // Update the mess menu
      existingMenu.date = normalizedDate;
      existingMenu.day = dayOfWeek.toLowerCase();
      existingMenu.breakfast = breakfast;
      existingMenu.lunch = lunch;
      existingMenu.snacks = snacks;
      existingMenu.dinner = dinner;
      existingMenu.updatedBy = createdById;
      existingMenu.updatedAt = getCurrentISTTime();

      await existingMenu.save();

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get mess menu by id

  todayHostelMenuByUserId = async (
    hostelId: string,
    mealDate?: string | Date
  ): Promise<TodayMenuResponse> => {
    if (!Types.ObjectId.isValid(hostelId)) {
      throw new Error("Invalid hostelId");
    }

    const hostelExists = await Hostel.exists({ _id: hostelId });
    if (!hostelExists) {
      throw new Error(RECORD_NOT_FOUND("Hostel"));
    }

    let dateOnly: string;

    if (!mealDate) {
      dateOnly = new Date().toISOString().split("T")[0];
    } else if (typeof mealDate === "string") {
      dateOnly = mealDate.includes("T") ? mealDate.split("T")[0] : mealDate;
    } else {
      dateOnly = mealDate.toISOString().split("T")[0];
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      throw new Error("Invalid mealDate format");
    }

    // Create a Date object at UTC midnight for the specified date
    const baseDate = new Date(`${dateOnly}T00:00:00+05:30`);

    const queryDate = new Date(
      Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
    );

    const menu = await MessMenu.findOne({
      hostelId,
      date: queryDate,
      status: true,
    })
      .select("date breakfast lunch snacks dinner -_id")
      .lean();

    if (!menu) {
      throw new Error(`Menu not found for date ${dateOnly}`);
    }

    return { messDetails: menu };
  };

  //SECTION: Method to book meal
  studentBookMeal = async (
    hostelId: string,
    studentId: string,
    fromDate: Date,
    toDate: Date,
    createdById: string,
    isfullDay: boolean,
    isBreakfastBooked?: boolean,
    isLunchBooked?: boolean,
    isDinnerBooked?: boolean,
    isSnacksBooked?: boolean
  ): Promise<string> => {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Get all dates between fromDate and toDate
      const dates = getDatesBetween(new Date(fromDate), new Date(toDate));

      // Check if there is a menu for each date
      const menuCheckPromises = dates.map(async (date) => {
        // Normalize the date to UTC midnight
        const normalizedDate = new Date(date);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        const menu = await MessMenu.findOne({
          hostelId,
          date: normalizedDate,
        });

        if (!menu) {
          throw new Error(
            `Menu does not exist for the date: ${date.toDateString()}`
          );
        }

        // Return mealId for the date to be used later
        return { date: normalizedDate, mealId: menu._id };
      });

      // Wait for all menu checks to complete
      const menuData = await Promise.all(menuCheckPromises);

      // Generate the first unique bookMealNumber
      let currentBookMealNumber = await this.generateBooKMealNumber();
      let booking: any;
      // Use Promise.all to process each date concurrently
      await Promise.all(
        dates.map(async (date, index) => {
          const normalizedDate = new Date(date);
          normalizedDate.setUTCHours(0, 0, 0, 0);

          // Get mealId for the current date
          const { mealId } = menuData[index];

          // Check for existing booking for the student on that date
          booking = await BookMeals.findOne({
            hostelId,
            studentId,
            date: normalizedDate,
          });

          // Determine booking status based on isFullDay
          const bookingStatus = {
            isBreakfastBooked: isfullDay === true ? true : isBreakfastBooked,
            isLunchBooked: isfullDay === true ? true : isLunchBooked,
            isDinnerBooked: isfullDay === true ? true : isDinnerBooked,
            isSnacksBooked: isfullDay === true ? true : isSnacksBooked,
          };

          if (booking) {
            // Update existing booking and save mealId
            booking.isBreakfastBooked = bookingStatus?.isBreakfastBooked;
            booking.isLunchBooked = bookingStatus?.isLunchBooked;
            booking.isDinnerBooked = bookingStatus?.isDinnerBooked;
            booking.isSnacksBooked = bookingStatus?.isSnacksBooked;
            booking.mealId = mealId; // Save the mealId
            booking.updatedBy = createdById;
            booking.bookingStatus =
              isfullDay === true
                ? MealBookingStatusTypes.BOOKED
                : MealBookingStatusTypes.PARTIALLY_BOOKED;
            await booking.save();
          } else {
            // Generate a new unique bookMealNumber for this booking
            const bookMealNumber = currentBookMealNumber;
            const lastNumber = parseInt(bookMealNumber.split("-")[1], 10) + 1;
            currentBookMealNumber = `BM-${String(lastNumber).padStart(3, "0")}`;

            // Create new booking and save mealId
            booking = await BookMeals.create({
              bookMealNumber,
              hostelId,
              studentId,
              date: normalizedDate,
              day: getDayOfWeek(normalizedDate),
              mealId,
              ...bookingStatus,
              bookingStatus:
                isfullDay === true
                  ? MealBookingStatusTypes.BOOKED
                  : MealBookingStatusTypes.PARTIALLY_BOOKED,
              createdBy: createdById,
              createdAt: getCurrentISTTime(),
              updatedAt: getCurrentISTTime(),
            });
          }
        })
      );

      if (booking) {
        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await fetchPlayerNotificationConfig(
            studentId,
            TemplateTypes.MEAL_BOOKED
          );

        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await getStudentAllocatedHostelDetails(
            student?._id,
            student?.hostelId,
            TemplateTypes.MEAL_BOOKED
          );

        //NOTE: Final notice created check.
        const finalNoticeCreated =
          isPlayedNoticeCreated && isHostelNoticeCreated;

        // NOTE: Combine available logs into an array
        const notificationLog = [log, hostelLogs].filter(Boolean);

        //NOTE: Retrieve only the date section from date & time.
        const startDate = formatDateOnly(fromDate);
        const endDate = formatDateOnly(toDate);

        const dynamicData = {
          startDate,
          endDate,
        };
        //NOTE: Add details for dynamic message using the populateTemplate.
        const description = populateTemplate(
          template?.description,
          dynamicData
        );

        //NOTE: Create entry in notice
        await Notice.create({
          userId: student?._id,
          hostelId: student?.hostelId,
          floorNumber: hostelDetail?.floorNumber,
          bedType: hostelDetail?.bedType,
          roomNumber: hostelDetail?.roomNumber,
          noticeTypes: NoticeTypes.PUSH_NOTIFICATION,
          pushNotificationTypes: PushNotificationTypes.AUTO,
          templateId: template?._id,
          templateSendMessage: description,
          isNoticeCreated: finalNoticeCreated,
          notificationLog,
          createdAt: getCurrentISTTime(),
        });

        //NOTE: Proceed to send push notification only when isNoticeCreated is true.
        if (finalNoticeCreated) {
          //NOTE: Use the send push notification function.
          await sendPushNotificationToUser(
            playedIds,
            template?.title,
            description,
            TemplateTypes.MEAL_BOOKED
          );
        }
      }
      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to book meal manually from warden panel
  manuallyBookMeal = async (
    hostelId: string,
    studentId: string,
    date: Date,
    mealTypes: MealCountReportType[], // mealTypes is now an array
    staffId: string
  ): Promise<string> => {
    try {
      const formattedDate = new Date(date);
      formattedDate.setUTCHours(0, 0, 0, 0);

      const menu = await MessMenu.findOne({
        hostelId,
        date: formattedDate,
      });

      if (!menu) {
        throw new Error(`Menu does not exist for the date: ${formattedDate}`);
      }

      // Generate the first unique bookMealNumber
      let currentBookMealNumber = await this.generateBooKMealNumber();

      // Initialize bookingStatus to false for all meal types
      const bookingStatus = {
        isBreakfastBooked: false,
        isLunchBooked: false,
        isDinnerBooked: false,
        isSnacksBooked: false,
      };

      // Loop through the mealTypes array and set the appropriate flags
      mealTypes.forEach((mealType) => {
        switch (mealType) {
          case MealCountReportType.FULL_DAY:
            bookingStatus.isBreakfastBooked = true;
            bookingStatus.isLunchBooked = true;
            bookingStatus.isDinnerBooked = true;
            bookingStatus.isSnacksBooked = true;
            break;
          case MealCountReportType.BREAKFAST:
            bookingStatus.isBreakfastBooked = true;
            break;
          case MealCountReportType.LUNCH:
            bookingStatus.isLunchBooked = true;
            break;
          case MealCountReportType.DINNER:
            bookingStatus.isDinnerBooked = true;
            break;
          case MealCountReportType.HI_TEA:
            bookingStatus.isSnacksBooked = true;
            break;
          default:
            break;
        }
      });

      // Determine if the booking is fully or partially booked
      const isFullyBooked =
        bookingStatus.isBreakfastBooked &&
        bookingStatus.isLunchBooked &&
        bookingStatus.isDinnerBooked &&
        bookingStatus.isSnacksBooked;

      const bookingStatusLabel = isFullyBooked
        ? MealBookingStatusTypes.BOOKED
        : MealBookingStatusTypes.PARTIALLY_BOOKED;

      // Check for existing booking for the student on that date
      let booking: any = await BookMeals.findOne({
        hostelId,
        studentId,
        date: formattedDate,
      });

      if (booking) {
        // Update existing booking and save mealId
        booking.isBreakfastBooked = bookingStatus.isBreakfastBooked;
        booking.isLunchBooked = bookingStatus.isLunchBooked;
        booking.isDinnerBooked = bookingStatus.isDinnerBooked;
        booking.isSnacksBooked = bookingStatus.isSnacksBooked;
        booking.mealId = menu._id;
        booking.updatedBy = studentId;
        booking.staffId = staffId;
        booking.isManualBooking = true;
        booking.bookingStatus = bookingStatusLabel;
        booking.updatedAt = getCurrentISTTime();
        await booking.save();
      } else {
        // Generate a new unique bookMealNumber for this booking
        const bookMealNumber = currentBookMealNumber;

        // Create new booking and save mealId
        booking = await BookMeals.create({
          mealId: menu._id,
          bookMealNumber,
          hostelId,
          studentId,
          date: formattedDate,
          ...bookingStatus,
          createdBy: studentId,
          staffId,
          isManualBooking: true,
          bookingStatus: bookingStatusLabel,
          createdAt: getCurrentISTTime(),
          updatedAt: getCurrentISTTime(),
        });
      }

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to cancel a booked meal
  cancelBookingByStudent = async (
    hostelId: string,
    studentId: string,
    fromDate: Date,
    toDate: Date,
    createdById: string,
    cancellationReason: string,
    isFullDay: boolean,
    isBreakfastBooked?: boolean,
    isLunchBooked?: boolean,
    isDinnerBooked?: boolean,
    isSnacksBooked?: boolean
  ): Promise<string> => {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Get all dates between fromDate and toDate
      const dates = getDatesBetween(new Date(fromDate), new Date(toDate));

      // Check if there is a menu for each date
      const menuCheckPromises = dates.map(async (date) => {
        const normalizedDate = new Date(date);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        const menuExists = await BookMeals.exists({
          hostelId,
          studentId,
          date: normalizedDate,
        });

        if (!menuExists) {
          throw new Error(
            `Booking does not exist for the date: ${date.toDateString()}`
          );
        }
      });

      // Wait for all menu checks to complete
      await Promise.all(menuCheckPromises);

      let booking: any;

      // Use Promise.all to process each date concurrently
      await Promise.all(
        dates.map(async (date) => {
          const normalizedDate = new Date(date);
          normalizedDate.setUTCHours(0, 0, 0, 0);

          // Check for existing booking for the student on that date
          booking = await BookMeals.findOne({
            hostelId,
            studentId,
            date: normalizedDate,
          });

          // Determine the new booking status based on isFullDay
          let bookingStatus;
          const bookingUpdateData = {
            isBreakfastBooked: false,
            isLunchBooked: false,
            isDinnerBooked: false,
            isSnacksBooked: false,
            updatedBy: createdById,
            updatedAt: getCurrentISTTime(),
            cancellationReason,
          };

          if (isFullDay) {
            // If isFullDay is true, update all meals to false and set status to cancelled
            bookingStatus = MealBookingStatusTypes.CANCELLED;
          } else {
            // If not full day, check the individual meal bookings
            const allMealsCancelled =
              !isBreakfastBooked &&
              !isLunchBooked &&
              !isDinnerBooked &&
              !isSnacksBooked;
            bookingStatus = allMealsCancelled
              ? MealBookingStatusTypes.CANCELLED
              : MealBookingStatusTypes.PARTIALLY_CANCELLED;

            // If only partially cancelling, keep the original booking values for the meals
            if (!allMealsCancelled) {
              bookingUpdateData.isBreakfastBooked = isBreakfastBooked ?? false;
              bookingUpdateData.isLunchBooked = isLunchBooked ?? false;
              bookingUpdateData.isDinnerBooked = isDinnerBooked ?? false;
              bookingUpdateData.isSnacksBooked = isSnacksBooked ?? false;
            }
          }

          if (booking) {
            // Update existing booking
            booking.isBreakfastBooked = bookingUpdateData.isBreakfastBooked;
            booking.isLunchBooked = bookingUpdateData.isLunchBooked;
            booking.isDinnerBooked = bookingUpdateData.isDinnerBooked;
            booking.isSnacksBooked = bookingUpdateData.isSnacksBooked;
            booking.updatedBy = bookingUpdateData.updatedBy;
            booking.updatedAt = bookingUpdateData.updatedAt;
            booking.cancellationReason = bookingUpdateData.cancellationReason;
            booking.bookingStatus = bookingStatus; // Set the updated booking status
            await booking.save();
          }
        })
      );

      if (booking) {
        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await fetchPlayerNotificationConfig(
            studentId,
            TemplateTypes.MEAL_CANCELLED
          );

        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await getStudentAllocatedHostelDetails(
            student?._id,
            student?.hostelId,
            TemplateTypes.MEAL_CANCELLED
          );

        //NOTE: Final notice created check.
        const finalNoticeCreated =
          isPlayedNoticeCreated && isHostelNoticeCreated;

        // NOTE: Combine available logs into an array
        const notificationLog = [log, hostelLogs].filter(Boolean);

        //NOTE: Retrieve only the date section from date & time.
        const startDate = formatDateOnly(fromDate);
        const endDate = formatDateOnly(toDate);

        const dynamicData = {
          startDate,
          endDate,
        };
        //NOTE: Add details for dynamic message using the populateTemplate.
        const description = populateTemplate(
          template?.description,
          dynamicData
        );

        //NOTE: Create entry in notice
        await Notice.create({
          userId: student?._id,
          hostelId: student?.hostelId,
          floorNumber: hostelDetail?.floorNumber,
          bedType: hostelDetail?.bedType,
          roomNumber: hostelDetail?.roomNumber,
          noticeTypes: NoticeTypes.PUSH_NOTIFICATION,
          pushNotificationTypes: PushNotificationTypes.AUTO,
          templateId: template?._id,
          templateSendMessage: description,
          isNoticeCreated: finalNoticeCreated,
          notificationLog,
          createdAt: getCurrentISTTime(),
        });
        //NOTE: Proceed to send push notification only when isNoticeCreated is true.
        if (finalNoticeCreated) {
          //NOTE: Use the send push notification function.
          await sendPushNotificationToUser(
            playedIds,
            template?.title,
            description,
            TemplateTypes.MEAL_CANCELLED
          );
        }
      }

      return MEAL_CANCELLED;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get cancelled meal of user
  // cancelledMealHistory = async (
  //   hostelId: string,
  //   studentId: string,
  //   status: MealBookingStatusTypes
  // ): Promise<{ cancelMeal: any[] }> => {
  //   try {
  //     const today = new Date();
  //     today.setUTCHours(0, 0, 0, 0);

  //     const hostel = await Hostel.exists({ _id: hostelId });

  //     if (!hostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

  //     // Build the query based on the status
  //     const query: any = {
  //       hostelId,
  //       studentId,
  //     };

  //     if (status === MealBookingStatusTypes.BOOKED) {
  //       query.bookingStatus = {
  //         $in: [
  //           MealBookingStatusTypes.BOOKED,
  //           MealBookingStatusTypes.PARTIALLY_CANCELLED,
  //         ],
  //       };
  //     } else {
  //       query.bookingStatus = MealBookingStatusTypes.CANCELLED;
  //     }

  //     // Get meals that are not booked (cancelled)
  //     const meals = await BookMeals.find(query).select(
  //       "date isBreakfastBooked isLunchBooked isDinnerBooked isSnacksBooked cancellationReason bookingStatus"
  //     );

  //     if (!meals || meals.length === 0) {
  //       return { cancelMeal: [] };
  //     }

  //     // Transform each meal into the desired response format
  //     const response = meals.map((meal) => ({
  //       _id: meal._id,
  //       date: meal.date ?? null,
  //       canUndoBooking: meal.date <= today ? false : true,
  //       editBooking: meal.date <= today ? false : true,
  //       breakfast: !!meal.isBreakfastBooked,
  //       lunch: !!meal.isLunchBooked,
  //       dinner: !!meal.isDinnerBooked,
  //       snacks: !!meal.isSnacksBooked,
  //       cancellationReason: meal.cancellationReason ?? null,
  //       bookingStatus: meal.bookingStatus ?? null,
  //     }));

  //     return { cancelMeal: response };
  //   } catch (error: any) {
  //     throw new Error(error.message);
  //   }
  // };

  //SECTION: Method to bulk uplaod a mess menu for hostel
  bulkUploadMessMenuForHostel = async (
    json: any[], // Incoming JSON data
    hostelId: string,
    createdById?: string,
    url?: string
  ): Promise<string> => {
    try {
      const successArray: any[] = [];
      const errorArray: any[] = [];

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Check if the hostel exists
      const existingHostel = await Hostel.exists({ _id: hostelId });
      if (!existingHostel) {
        throw new Error(RECORD_NOT_FOUND("Hostel"));
      }

      // Convert Excel date format to JS Date format
      const jsonWithDates = json.map((item) => ({
        ...item,
        date: excelDateToJSDate(item?.date),
      }));

      // Group the JSON data by date
      const groupedData = groupDataByDate(jsonWithDates);

      const bulkUpload = await BulkUpload.create({
        originalFile: url,
        fileType: BulkUploadTypes.MEAL,
        createdBy: createdById,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      // Iterate over the grouped data and process the mess menu
      for (const [date, menuItems] of Object.entries(groupedData)) {
        try {
          const normalizedDate = new Date(date);
          normalizedDate.setUTCHours(0, 0, 0, 0); // Normalize the date to UTC midnight

          const dayOfWeek = getDayOfWeek(normalizedDate);

          const existingMenu: any = await MessMenu.findOne({
            hostelId,
            date: normalizedDate,
          });

          // Extract meal details
          const { breakfast, lunch, snacks, dinner } =
            getMealDetails(menuItems);

          if (existingMenu) {
            // If the mess menu for the date already exists, update it
            existingMenu.breakfast = breakfast;
            existingMenu.lunch = lunch;
            existingMenu.snacks = snacks;
            existingMenu.dinner = dinner;
            existingMenu.day = dayOfWeek.toLowerCase();
            existingMenu.updatedBy = createdById;
            existingMenu.updatedAt = getCurrentISTTime();
            await existingMenu.save();

            successArray.push({
              date: normalizedDate,
              status: "Updated",
              message: "Mess menu updated successfully",
            });
          } else {
            // Generate a uniqueId for the new entry
            const uniqueId = await this.generateMessMenuUniqueId();

            // Create the new menu object
            const newMenu = new MessMenu({
              uniqueId,
              hostelId,
              date: normalizedDate,
              day: dayOfWeek.toLowerCase(),
              breakfast,
              lunch,
              snacks,
              dinner,
              createdBy: createdById,
              createdAt: getCurrentISTTime(),
              updatedAt: getCurrentISTTime(),
            });

            await newMenu.save();

            successArray.push({
              date: normalizedDate,
              status: "Created",
              message: "New mess menu created successfully",
            });
          }
        } catch (error: any) {
          errorArray.push({
            date,
            status: "Error",
            message: error.message,
          });
        }
      }

      // If there are successes or errors, generate CSV/Excel files and upload them to AWS S3
      let successFileUrl = null;
      let errorFileUrl = null;

      if (successArray.length > 0) {
        successFileUrl = await pushToS3Bucket(
          successArray,
          process.env.S3_BUCKET_NAME as string,
          MESS_BULK_UPLOAD_FILES
        );
      }

      if (errorArray.length > 0) {
        errorFileUrl = await pushToS3Bucket(
          errorArray,
          process.env.S3_BUCKET_NAME as string,
          MESS_BULK_UPLOAD_FILES
        );
      }

      // Update bulk upload record with success and error file URLs
      await BulkUpload.findByIdAndUpdate(bulkUpload._id, {
        $set: {
          successFile: successFileUrl,
          errorFile: errorFileUrl,
          updatedAt: getCurrentISTTime(),
        },
      });

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to Reverse the booking
  bookingReversible = async (mealId: string): Promise<string> => {
    try {
      //NOTE - update the the meal
      await BookMeals.findByIdAndUpdate(mealId, {
        $set: {
          bookingStatus: MealBookingStatusTypes.BOOKED,
          cancellationReason: null,
        },
      });

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to book meal
  studentEditBookedMeal = async (
    studentId: string,
    bookingId: string,
    isFullDay: boolean,
    isBreakfastBooked?: boolean,
    isLunchBooked?: boolean,
    isDinnerBooked?: boolean,
    isSnacksBooked?: boolean
  ): Promise<string> => {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Check for existing booking for the student by bookingId
      const booking = await BookMeals.findById(bookingId);
      if (!booking) {
        throw new Error(RECORD_NOT_FOUND("Booked meal"));
      }

      // Determine meal booking status based on isFullDay and individual meal flags
      const bookingUpdateData = {
        isBreakfastBooked: isFullDay ? true : isBreakfastBooked,
        isLunchBooked: isFullDay ? true : isLunchBooked,
        isDinnerBooked: isFullDay ? true : isDinnerBooked,
        isSnacksBooked: isFullDay ? true : isSnacksBooked,
      };

      const allMealsCancelled = Object.values(bookingUpdateData).every(
        (value) => !value
      );

      const bookingStatus = isFullDay
        ? MealBookingStatusTypes.CANCELLED
        : allMealsCancelled
          ? MealBookingStatusTypes.CANCELLED
          : MealBookingStatusTypes.PARTIALLY_CANCELLED;
      // Update the booking with new meal status and booking status
      booking.set({
        ...bookingUpdateData,
        updatedBy: studentId,
        bookingStatus,
        updatedAt: getCurrentISTTime(),
      });

      // Save the updated booking
      await booking.save();

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method get meal dates based on status
  fetchMealDates = async (
    date: string,
    studentId: string
  ): Promise<{ mealDates: any[] }> => {
    try {
      // Get the first and last dates of the month
      const { startOfMonth, endOfMonth } = getMonthDateRange(date);

      // Query the database for bookings within the date range
      const meals = await BookMeals.find({
        studentId: new mongoose.Types.ObjectId(studentId),
        date: { $gte: startOfMonth, $lte: endOfMonth },
        bookingStatus: MealBookingStatusTypes.BOOKED,
        status: true,
      }).select("date");

      // Extract and return the booked dates
      const mealDates = meals
        .map((meal) => meal.date.toISOString())
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      return { mealDates };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get book meal details based on meal status
  getBookedMealDetails = async (
    page: number,
    limit: number,
    status: MealBookingStatusTypes,
    mealType: MealCountReportType,
    search?: string,
    sort?: SortingTypes,
    hostelId?: string,
    floorNumber?: string,
    roomNumber?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ mealDetails: any[]; count: number }> => {
    try {
      // Build search parameters based on search input
      const hostelSearch = hostelId ? { hostelId } : {};
      const skip = (page - 1) * limit;
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

      // Meal conditions mapping for different report types
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
          const statusValue =
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

          searchParams.bookingStatus = { $in: statusValue };

          if (mealType !== MealCountReportType.ALL) {
            const condition = mealConditions[mealType];
            if (condition) {
              Object.assign(searchParams, condition);
            } else {
              throw new Error(INVALID_REPORT_TYPE("Meal Report"));
            }
          }
          break;

        case MealBookingStatusTypes.SKIPPED:
          return { mealDetails: [], count: 0 };

        case MealBookingStatusTypes.NOT_BOOKED:
          const [allStudents, bookedStudentIds] = await Promise.all([
            User.find({ isVerified: true, ...hostelSearch }).select(
              "name image uniqueId phone"
            ),
            BookMeals.distinct("studentId", {
              ...hostelSearch,
              bookingStatus: { $ne: MealBookingStatusTypes.CANCELLED },
            }),
          ]);

          const bookedStudentIdsSet = new Set(
            bookedStudentIds.map((id: any) => id.toString())
          );
          const defaulters = allStudents.filter(
            (student: any) => !bookedStudentIdsSet.has(student._id.toString())
          );

          const result = await Promise.all(
            defaulters.map(async (student: any) => {
              const studentHostelData = await StudentHostelAllocation.findOne({
                studentId: student._id,
              });
              return {
                _id: student._id,
                bookMealNumber: null,
                userId: student._id,
                uniqueId: student.uniqueId ?? null,
                name: student.name ?? null,
                phone: student.phone ?? null,
                image: student?.image
                  ? await getSignedUrl(student?.image)
                  : null,
                date: null,
                bookedOn: null,
                mealType: null,
                floorNumber: studentHostelData?.floorNumber ?? null,
                roomNumber: studentHostelData?.roomNumber ?? null,
              };
            })
          );

          if (sort === SortingTypes.ASCENDING) {
            result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          } else if (sort === SortingTypes.DESCENDING) {
            result.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
          }

          return { mealDetails: result, count: result.length };

        default:
          throw new Error(INVALID_REPORT_TYPE("Meal Report"));
      }

      let userIds: mongoose.Types.ObjectId[] = [];

      // Search by user name
      if (search) {
        const matchingStudentIds: any = await User.find({
          name: { $regex: `^${search}`, $options: "i" },
        }).select("_id");

        if (matchingStudentIds.length > 0) {
          userIds = matchingStudentIds.map((entry: any) => entry._id);
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
      // Fetch count and meal details
      const [count, bookMealDetails] = await Promise.all([
        BookMeals.countDocuments({
          ...searchParams,
          ...searchUserParams,
          ...hostelSearch,
        }),
        BookMeals.find({
          ...searchParams,
          ...searchUserParams,
          ...hostelSearch,
        })
          .populate([
            { path: "studentId", select: "name email phone uniqueId image" },
          ])
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      const result = await Promise.all(
        bookMealDetails.map(async (meal: any) => {
          const mealTypes: string[] = [];
          if (
            (mealType === MealCountReportType.ALL ||
              mealType === MealCountReportType.BREAKFAST) &&
            meal.isBreakfastBooked
          ) {
            mealTypes.push("Breakfast");
          }
          if (
            (mealType === MealCountReportType.ALL ||
              mealType === MealCountReportType.LUNCH) &&
            meal.isLunchBooked
          ) {
            mealTypes.push("Lunch");
          }
          if (
            (mealType === MealCountReportType.ALL ||
              mealType === MealCountReportType.DINNER) &&
            meal.isDinnerBooked
          ) {
            mealTypes.push("Dinner");
          }
          if (
            (mealType === MealCountReportType.ALL ||
              mealType === MealCountReportType.HI_TEA) &&
            meal.isSnacksBooked
          ) {
            mealTypes.push("Hi-Tea");
          }

          const studentHostelData: any = await StudentHostelAllocation.findOne({
            studentId: meal.studentId?._id,
            hostelId: meal?.hostelId,
          });

          return {
            _id: meal?._id,
            bookMealNumber: meal?.bookMealNumber ?? null,
            userId: meal?.studentId?._id ?? null,
            uniqueId: meal?.studentId?.uniqueId ?? null,
            name: meal.studentId?.name ?? null,
            phone: meal?.studentId?.phone ?? null,
            image: meal?.studentId?.image
              ? await getSignedUrl(meal?.studentId?.image)
              : null,
            date: meal?.date,
            mealType: mealTypes.join(", ") || null,
            floorNumber: studentHostelData?.floorNumber ?? null,
            roomNumber: studentHostelData?.roomNumber ?? null,
            bookedOn: meal?.createdAt,
          };
        })
      );

      // Manual Sorting based on `userId.name`
      if (sort === SortingTypes.ASCENDING) {
        result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      } else if (sort === SortingTypes.DESCENDING) {
        result.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
      }

      return { mealDetails: result, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get bookMeal by Id
  async getBookMealById(bookMealId: string): Promise<{ data: any }> {
    try {
      // Fetch the booked meal details by ID
      const meal: any = await BookMeals.findById(bookMealId).populate([
        { path: "studentId", select: "name uniqueId phone image" },
        { path: "hostelId", select: "name" },
      ]);

      if (!meal) {
        throw new Error(RECORD_NOT_FOUND("Book Meal"));
      }

      // Determine meal types based on booking flags
      const mealTypes: string[] = [];

      if (meal.isBreakfastBooked) mealTypes.push("Breakfast");
      if (meal.isLunchBooked) mealTypes.push("Lunch");
      if (meal.isDinnerBooked) mealTypes.push("Dinner");
      if (meal.isSnacksBooked) mealTypes.push("Hi-Tea");

      // Fetch student hostel allocation details
      const studentHostelData: any = await StudentHostelAllocation.findOne({
        studentId: meal.studentId?._id,
        hostelId: meal?.hostelId,
      });

      const image = await getSignedUrl(meal.studentId?.image);

      // Fetch the previous booked meal ID
      const nextMeal: any = await BookMeals.findOne(
        {
          _id: { $gt: new mongoose.Types.ObjectId(bookMealId) },
          bookingStatus: meal.bookingStatus,
        },
        { _id: 1 }
      ).sort({ _id: 1 });

      // Fetch the previous booked meal ID
      const previousMeal: any = await BookMeals.findOne(
        {
          _id: { $lt: new mongoose.Types.ObjectId(bookMealId) },
          bookingStatus: meal.bookingStatus,
        },
        { _id: 1 }
      ).sort({ _id: -1 });

      const nextMealId = nextMeal ? nextMeal._id.toString() : null;
      const previousMealId = previousMeal ? previousMeal._id.toString() : null;

      // Construct the result
      const result = {
        _id: meal?._id,
        mealStatus: meal?.bookingStatus ?? null,
        studentId: meal?.studentId?._id ?? null,
        uniqueId: meal?.studentId?.uniqueId ?? null,
        image: image ?? null,
        name: meal.studentId?.name ?? null,
        phone: meal.studentId?.phone ?? null,
        hostelId: meal.hostelId?._id ?? null,
        hostelname: meal.hostelId?.name ?? null,
        bookedOn: meal?.createdAt ?? null,
        duration: meal?.date ?? null,
        mealType: mealTypes.join(", ") || null,
        roomNumber: studentHostelData?.roomNumber ?? null,
        nextMealId,
        previousMealId,
      };

      return { data: result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION get history of Meal details for each user
  async fetchIndividualBookMealDetails(
    studentId: string,
    page: number,
    limit: number,
    durationType: ReportDropDownTypes,
    startDate?: string,
    endDate?: string
  ): Promise<{ data: any[]; count: number }> {
    try {
      const skip = (page - 1) * limit;

      let dates: Date[] = [];
      // Check if durationType is custom, otherwise use the predefined date range
      let start: Date | null = null;
      let end: Date | null = null;

      if (durationType === ReportDropDownTypes.CUSTOM && startDate && endDate) {
        const formatedStartDate = new Date(startDate);
        formatedStartDate.setUTCHours(0, 0, 0, 0);

        const formatedend = new Date(endDate);
        formatedend.setUTCHours(23, 59, 59, 999);

        start = formatedStartDate;
        end = formatedend;
      } else {
        // Otherwise, use the getDateRange function for the given durationType
        const range = getDateRange(durationType as ReportDropDownTypes);
        start = range.start ? new Date(range.start) : null;
        end = range.end ? new Date(range.end) : null;
      }

      // If start and end are available, get the dates between them
      if (start && end) {
        dates = getDatesBetween(start, end);
      }

      // Fetch the count and booked meals within the date range
      const [count, bookMeals] = await Promise.all([
        await BookMeals.countDocuments({
          studentId,
          date: { $in: dates },
        }),
        await BookMeals.find({
          studentId,
          date: { $in: dates },
        })
          .populate([{ path: "studentId", select: "name uniqueId image" }])
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      // Process the booked meals
      const result = await Promise.all(
        bookMeals?.map(async (meal: any) => {
          const mealTypes: string[] = [];
          if (meal.isBreakfastBooked) mealTypes.push("Breakfast");
          if (meal.isLunchBooked) mealTypes.push("Lunch");
          if (meal.isDinnerBooked) mealTypes.push("Dinner");
          if (meal.isSnacksBooked) mealTypes.push("Hi-Tea");

          return {
            _id: meal?._id,
            bookMealNumber: meal?.bookMealNumber ?? null,
            studentId: meal?.studentId?._id ?? null,
            uniqueId: meal?.studentId?.uniqueId ?? null,
            studentName: meal.studentId?.name ?? null,
            image: await getSignedUrl(meal?.studentId?.image),
            duration: meal?.date ?? null,
            mealType: mealTypes.join(", ") || null,
            bookedOn: meal?.createdAt ?? null,
          };
        })
      );

      return { data: result, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION - get history of Meal details
  fetchGatepassInfoByMealId = async (
    bookMealId: string
  ): Promise<{ data: any }> => {
    try {
      const bookMeal: any = await BookMeals.findById(bookMealId)
        .populate([{ path: "studentId", select: "name uniqueId image" }])
        .lean();

      if (!bookMeal) throw new Error(RECORD_NOT_FOUND("Book Meal"));

      const mealTypes: string[] = [];

      if (bookMeal.isBreakfastBooked) mealTypes.push("Breakfast");
      if (bookMeal.isLunchBooked) mealTypes.push("Lunch");
      if (bookMeal.isDinnerBooked) mealTypes.push("Dinner");
      if (bookMeal.isSnacksBooked) mealTypes.push("Hi-Tea");

      // Construct the result
      const result = {
        _id: bookMeal?._id,
        bookMealNumber: bookMeal?.bookMealNumber ?? null,
        mealStatus: bookMeal?.bookingStatus ?? null,
        studentId: bookMeal?.studentId?._id ?? null,
        uniqueId: bookMeal?.studentId?.uniqueId ?? null,
        name: bookMeal.studentId?.name ?? null,
        bookedOn: bookMeal?.date ?? null,
        mealType: mealTypes.join(", ") || null,
      };
      return { data: result };
    } catch (error: any) {
      throw new Error(`${error.message}`);
    }
  };

  //SECTION -fetch Manually Booked Meals
  fetchManuallyBookedMeals = async (
    page: number,
    limit: number,
    mealType: MealCountReportType,
    sort?: SortingTypes,
    hostelId?: string,
    startDate?: string,
    endDate?: string,
    floorNumber?: string,
    roomNumber?: string
  ): Promise<{ users: any; count: number }> => {
    try {
      const hostelSearch = hostelId ? { hostelId } : {};
      const skip = (page - 1) * limit;
      let searchUserParams: any = {};
      let searchParams: any = {};

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

      let userIds: mongoose.Types.ObjectId[] = [];
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

      if ((floorNumber || roomNumber) && userIds) {
        searchUserParams.studentId = {
          $in: userIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }

      const filterConditions = {
        isManualBooking: true,
        ...searchUserParams,
        ...searchParams,
        ...hostelSearch,
        ...mealConditions[mealType],
      };

      const [count, bookMealDetails] = await Promise.all([
        BookMeals.countDocuments(filterConditions),
        BookMeals.find(filterConditions)
          .populate([
            { path: "hostelId", select: "name" },
            { path: "studentId", select: "name email phone uniqueId image" },
          ])
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      const result = await Promise.all(
        bookMealDetails.map(async (meal: any) => {
          let mealTypes: string[] = [];

          // Check if ALL is selected and all meals are booked
          if (
            mealType === MealCountReportType.ALL &&
            meal.isBreakfastBooked &&
            meal.isLunchBooked &&
            meal.isDinnerBooked &&
            meal.isSnacksBooked
          ) {
            mealTypes = ["Breakfast", "Lunch", "Dinner", "Hi-Tea"];
          } else {
            // Add specific meal type based on the mealReportType
            if (
              mealType === MealCountReportType.BREAKFAST &&
              meal.isBreakfastBooked
            ) {
              mealTypes.push("Breakfast");
            }
            if (mealType === MealCountReportType.LUNCH && meal.isLunchBooked) {
              mealTypes.push("Lunch");
            }
            if (
              mealType === MealCountReportType.DINNER &&
              meal.isDinnerBooked
            ) {
              mealTypes.push("Dinner");
            }
            if (
              mealType === MealCountReportType.HI_TEA &&
              meal.isSnacksBooked
            ) {
              mealTypes.push("Hi-Tea");
            }
            if (mealType === MealCountReportType.FULL_DAY) {
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
            _id: meal?._id,
            hostel: meal?.hostelId?.name ?? null,
            bookMealNumber: meal?.bookMealNumber ?? null,
            userId: meal?.studentId?._id ?? null,
            uniqueId: meal?.studentId?.uniqueId ?? null,
            name: meal.studentId?.name ?? null,
            phone: meal.studentId?.phone ?? null,
            image: meal?.studentId?.image
              ? await getSignedUrl(meal?.studentId?.image)
              : null,
            date: meal?.date,
            mealType:
              mealType === MealCountReportType.ALL
                ? mealTypes
                : mealTypes.join(", ") || null,
            floorNumber: studentHostelData?.floorNumber ?? null,
            roomNumber: studentHostelData?.roomNumber ?? null,
            bookedOn: meal?.createdAt,
          };
        })
      );

      return { users: result, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //ANCHOR - generate Book Meal Number
  generateBooKMealNumber = async (): Promise<string> => {
    try {
      // Find the last bookMealNumber in descending order
      const lastBookMeal: any = await BookMeals.findOne()
        .sort({ bookMealNumber: -1 })
        .select("bookMealNumber");

      let newBookMealNumber = "BM-001"; // Default value if no previous record

      if (lastBookMeal && lastBookMeal.bookMealNumber) {
        // Extract the numeric part of the last bookMealNumber and parse it as an integer
        const lastNumber = parseInt(
          lastBookMeal.bookMealNumber.replace("BM-", ""),
          10
        );

        // Increment the last number by 1
        const nextNumber = lastNumber + 1;

        // Format the next number with leading zeros and append it to "BM-"
        newBookMealNumber = "BM-" + String(nextNumber).padStart(3, "0");
      }

      return newBookMealNumber;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //ANCHOR - generate Mess menu unique id
  generateMessMenuUniqueId = async (): Promise<string> => {
    try {
      // Find the last created record sorted by `uniqueId` in descending order
      const lastMeal = await MessMenu.findOne({})
        .sort({ uniqueId: -1 })
        .select("uniqueId");

      let newMealNumber = "M001";

      if (lastMeal && lastMeal?.uniqueId) {
        // Extract the numeric part from uniqueId (e.g., "M123" -> 123)
        const lastNumber = parseInt(lastMeal.uniqueId.substring(1), 10);
        const nextNumber = lastNumber + 1;

        newMealNumber = `M${String(nextNumber).padStart(3, "0")}`;
      }

      return newMealNumber;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //  Bulk meal booking for student method
  studentBookMealBulk = async (
    hostelId: string,
    studentId: string,
    bookings: Array<{
      date: string;
      meals: {
        breakfast: string;
        lunch: string;
        snacks: string;
        dinner: string;
      };
    }>
  ): Promise<{
    results: Array<{
      date: string;
      breakfast: { status: string; reason?: string };
      lunch: { status: string; reason?: string };
      snacks: { status: string; reason?: string };
      dinner: { status: string; reason?: string };
    }>;
    summary: { confirmed: number; rejected: number; cancelled: number };
  }> => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const today = dayjs().tz("Asia/Kolkata").startOf("day");

      // Deduplicate bookings by date - keep last occurrence of each date
      const dedupMap = new Map<string, (typeof bookings)[0]>();
      for (const b of bookings) {
        dedupMap.set(normalizeDateKey(b.date), b);
      }
      const dedupedBookings = Array.from(dedupMap.values());

      // Batch fetch: policy, leaves, existing bookings, menus
      const dates = dedupedBookings.map((b) => {
        const d = new Date(b.date);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      });

      // Use session for consistency if possible, though strict requirement is WRITES.
      // We'll proceed with reads normally to minimize locking, unless critical.
      const [policy, leaves, existingBookings, menus] = await Promise.all([
        HostelPolicy.findOne({ hostelId, status: true }).lean(),
        StudentLeave.find({
          userId: studentId,
          leaveStatus: LeaveStatusTypes.APPROVED,
          startDate: { $lte: dates[dates.length - 1] },
          endDate: { $gte: dates[0] },
        }).lean(),
        BookMeals.find({
          hostelId,
          studentId,
          date: { $in: dates },
        })
          .session(session)
          .lean(),
        MessMenu.find({
          hostelId,
          date: { $in: dates },
        }).lean(),
      ]);

      // Create maps for quick lookup
      const existingBookingMap = new Map<string, any>();
      for (const b of existingBookings) {
        existingBookingMap.set(normalizeDateKey(b.date), b);
      }

      // Menu map
      const menuMap = new Map<string, any>();
      for (const m of menus) {
        menuMap.set(normalizeDateKey(m.date), m);
      }

      // Pre-compute cutoff checks
      const cutoffMap = new Map<string, boolean>();
      const currentIST = dayjs().tz("Asia/Kolkata");

      const mealDefaults = {
        breakfast: { dayOffset: -1, time: "21:00" },
        lunch: { dayOffset: 0, time: "08:00" },
        snacks: { dayOffset: 0, time: "13:00" },
        dinner: { dayOffset: 0, time: "16:00" },
      };

      for (const dateStr of dedupMap.keys()) {
        const mealDate = dayjs(dateStr).tz("Asia/Kolkata").startOf("day");

        for (const mealName of [
          "breakfast",
          "lunch",
          "snacks",
          "dinner",
        ] as const) {
          let dayOffset: number = mealDefaults[mealName].dayOffset;
          let time: string = mealDefaults[mealName].time;

          if (policy?.bookingCutoffs?.[mealName]) {
            dayOffset = policy.bookingCutoffs[mealName].dayOffset;
            time = policy.bookingCutoffs[mealName].time;
          }

          const [hours, mins] = time.split(":").map(Number);
          const cutoffTime = mealDate
            .add(dayOffset, "day")
            .set("hour", hours)
            .set("minute", mins)
            .set("second", 0)
            .set("millisecond", 0);

          const isPassed = currentIST.isAfter(cutoffTime);
          cutoffMap.set(`${dateStr}_${mealName}`, isPassed);
        }
      }

      const results: Array<{
        date: string;
        breakfast: { status: string; reason?: string };
        lunch: { status: string; reason?: string };
        snacks: { status: string; reason?: string };
        dinner: { status: string; reason?: string };
      }> = [];

      let confirmed = 0;
      let rejected = 0;
      let cancelled = 0;
      let bookMealNumber = await this.generateBooKMealNumber();

      for (const booking of dedupedBookings) {
        const dateKey = normalizeDateKey(booking.date);
        const mealDate = new Date(dateKey);
        mealDate.setUTCHours(0, 0, 0, 0);

        // Range check for leaves: replacing map expansion
        const hasLeave = leaves.some((leave) => {
          const start = new Date(leave.startDate);
          const end = new Date(leave.endDate);
          return mealDate >= start && mealDate <= end;
        });

        const existingBooking = existingBookingMap.get(dateKey);
        const menu = menuMap.get(dateKey);

        const mealResults: any = { date: dateKey };
        const mealsUpdate: any = {};

        // Default / Existing State
        let currentMeals = existingBooking
          ? existingBooking.meals
          : {
            breakfast: { status: MealBookingIntent.PENDING, locked: false },
            lunch: { status: MealBookingIntent.PENDING, locked: false },
            snacks: { status: MealBookingIntent.PENDING, locked: false },
            dinner: { status: MealBookingIntent.PENDING, locked: false },
          };

        for (const meal of [
          "breakfast",
          "lunch",
          "snacks",
          "dinner",
        ] as const) {
          const requestedStatus = booking.meals[meal] as MealBookingIntent;
          const currentMealState = currentMeals[meal];

          //  Validations
          if (!menu) {
            mealResults[meal] = { status: "rejected", reason: "no_menu" };
            rejected++;
            mealsUpdate[meal] = currentMealState;
            continue;
          }

          const mealContent = menu[meal];
          if (!mealContent || mealContent.trim() === "") {
            mealResults[meal] = { status: "rejected", reason: "no_menu_item" };
            mealsUpdate[meal] = currentMealState;
            continue;
          }

          // Compare using dayjs for consistency or simple date comparison
          if (dayjs(mealDate).isBefore(today)) {
            mealResults[meal] = { status: "rejected", reason: "past_date" };
            rejected++;
            mealsUpdate[meal] = currentMealState;
            continue;
          }

          // Lock Check
          if (currentMealState.locked) {
            mealResults[meal] = {
              status: "rejected",
              reason: "locked",
              error: "Meal is locked",
            };
            rejected++;
            mealsUpdate[meal] = currentMealState;
            continue;
          }

          // Status Logic
          let newStatus = requestedStatus;

          const isCutoffPassed = cutoffMap.get(`${dateKey}_${meal}`);

          if (isCutoffPassed) {
            mealResults[meal] = {
              status: "rejected",
              reason: "cutoff_passed",
              error: "Meal booking/cancellation cut-off time passed",
            };
            rejected++;
            mealsUpdate[meal] = currentMealState;
            continue;
          }

          if (hasLeave) {
            if (newStatus === MealBookingIntent.CONFIRMED) {
              mealResults[meal] = { status: "rejected", reason: "leave" };
              rejected++;
              mealsUpdate[meal] = currentMealState;
              continue;
            }
          }

          if (newStatus === MealBookingIntent.CONFIRMED) {
            confirmed++;
          } else if (newStatus === MealBookingIntent.SKIPPED) {
            cancelled++;
          }

          // Update State
          mealResults[meal] = { status: newStatus };
          mealsUpdate[meal] = {
            status: newStatus,
            locked: false,
            consumed: false,
          };
        }

        results.push(mealResults);

        // Upsert
        if (existingBooking) {
          await BookMeals.updateOne(
            { _id: existingBooking._id },
            {
              $set: {
                meals: { ...currentMeals, ...mealsUpdate },
                isManualBooking: true,
                updatedBy: studentId,
                updatedAt: getCurrentISTTime(),
              },
            },
            { session } // Transaction
          );
        } else if (menu && !dayjs(mealDate).isBefore(today)) {
          const finalMeals = {
            breakfast: { status: MealBookingIntent.PENDING, locked: false },
            lunch: { status: MealBookingIntent.PENDING, locked: false },
            snacks: { status: MealBookingIntent.PENDING, locked: false },
            dinner: { status: MealBookingIntent.PENDING, locked: false },
            ...mealsUpdate,
          };

          // Use array to Create within transaction
          await BookMeals.create(
            [
              {
                mealId: menu._id,
                bookMealNumber,
                hostelId,
                studentId,
                date: mealDate,
                meals: finalMeals,
                isManualBooking: true,
                createdBy: studentId,
                createdAt: getCurrentISTTime(),
                updatedAt: getCurrentISTTime(),
              },
            ],
            { session }
          );

          const num = parseInt(bookMealNumber.split("-")[1], 10) + 1;
          bookMealNumber = `BM-${String(num).padStart(3, "0")}`;
        }
      }

      await session.commitTransaction();
      return { results, summary: { confirmed, rejected, cancelled } };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  };

  // Get monthly meal booking view for student
  getStudentMealBookingMonthlyView = async (
    hostelId: string,
    studentId: string,
    dateStr?: string, // Made optional for full month view
    year?: number, // Year for month view
    month?: number // Month for month view (1-12)
  ): Promise<{
    results: Array<{
      date: string;
      meals: {
        breakfast: {
          state: string;
          locked: boolean;
          food: string | null;
          consumed: boolean;
        };
        lunch: {
          state: string;
          locked: boolean;
          food: string | null;
          consumed: boolean;
        };
        snacks: {
          state: string;
          locked: boolean;
          food: string | null;
          consumed: boolean;
        };
        dinner: {
          state: string;
          locked: boolean;
          food: string | null;
          consumed: boolean;
        };
      };
      createdAt?: Date | string;
    }>;
    mealTimings?: {
      breakfast?: { start: string; end: string };
      lunch?: { start: string; end: string };
      snacks?: { start: string; end: string };
      dinner?: { start: string; end: string };
    };
  }> => {
    // Current time in IST
    const today = dayjs().tz("Asia/Kolkata").startOf("day");

    let rangeStart: Date;
    let rangeEnd: Date;
    let iterations: number;
    let startDateKey: string;

    if (dateStr) {
      // Single date
      const targetDate = dayjs(dateStr).tz("Asia/Kolkata").startOf("day");
      rangeStart = targetDate.utc().toDate();
      rangeEnd = targetDate.endOf("day").utc().toDate();
      startDateKey = targetDate.format("YYYY-MM-DD");
      iterations = 1;
    } else if (year && month) {
      // Year + Month format (new logic)
      const dateStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const inputDate = dayjs(dateStr).tz("Asia/Kolkata").startOf("month");
      rangeStart = inputDate.utc().toDate();

      const endMoment = inputDate.endOf("month");
      rangeEnd = endMoment.utc().toDate();

      startDateKey = inputDate.format("YYYY-MM-DD");
      iterations = endMoment.date();
    } else {
      //month data
      const inputDate = dayjs().tz("Asia/Kolkata").startOf("month");
      rangeStart = inputDate.utc().toDate();

      const endMoment = inputDate.endOf("month");
      rangeEnd = endMoment.utc().toDate();

      startDateKey = inputDate.format("YYYY-MM-DD");
      iterations = endMoment.date();
    }

    // Batch fetch: policy, leaves, bookings, menu, meal timings
    const [policy, leaves, bookings, menus, hostelMealTiming] =
      await Promise.all([
        HostelPolicy.findOne({ hostelId, status: true }).lean(),
        StudentLeave.find({
          userId: studentId,
          leaveStatus: LeaveStatusTypes.APPROVED,
          startDate: { $lte: rangeEnd },
          endDate: { $gte: rangeStart },
        }).lean(),
        BookMeals.find({
          hostelId,
          studentId,
          date: { $gte: rangeStart, $lte: rangeEnd },
        }).lean(),
        MessMenu.find({
          hostelId,
          date: { $gte: rangeStart, $lte: rangeEnd },
        }).lean(),
        HostelMealTiming.findOne({ hostelId, status: true }).lean(),
      ]);

    // Helper: Format time from 24h to 12h AM/PM
    const formatTime = (time: string): string => {
      const [hour, minute] = time.split(":").map(Number);
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return minute > 0
        ? `${displayHour}:${minute.toString().padStart(2, "0")}${period}`
        : `${displayHour}${period}`;
    };

    const mealTimings: {
      breakfast?: { start: string; end: string };
      lunch?: { start: string; end: string };
      snacks?: { start: string; end: string };
      dinner?: { start: string; end: string };
    } = {};

    // Raw timings for logic (24h format)
    const timings = (hostelMealTiming || {}) as any;
    const rawMealTimings: Record<string, string> = {
      breakfast: timings.breakfastStartTime || "07:00",
      lunch: timings.lunchStartTime || "12:00",
      snacks: timings.snacksStartTime || "17:00",
      dinner: timings.dinnerStartTime || "19:30",
    };

    // Format meal timings for response
    mealTimings.breakfast = {
      start: formatTime(rawMealTimings.breakfast),
      end: formatTime(timings.breakfastEndTime || "10:00"),
    };
    mealTimings.lunch = {
      start: formatTime(rawMealTimings.lunch),
      end: formatTime(timings.lunchEndTime || "15:30"),
    };
    mealTimings.snacks = {
      start: formatTime(rawMealTimings.snacks),
      end: formatTime(timings.snacksEndTime || "19:00"),
    };
    mealTimings.dinner = {
      start: formatTime(rawMealTimings.dinner),
      end: formatTime(timings.dinnerEndTime || "22:00"),
    };

    // Precompute leave date ranges to avoid repeated timezone conversions
    const leaveRanges = leaves.map((leave) => ({
      start: dayjs(leave.startDate).tz("Asia/Kolkata"),
      end: dayjs(leave.endDate).tz("Asia/Kolkata"),
    }));

    const bookingMap = new Map<string, any>();
    for (const b of bookings) {
      const key = dayjs(b.date).tz("Asia/Kolkata").format("YYYY-MM-DD");
      bookingMap.set(key, b);
    }

    const menuMap = new Map<string, any>();
    for (const m of menus) {
      const key = dayjs(m.date).tz("Asia/Kolkata").format("YYYY-MM-DD");
      menuMap.set(key, m);
    }

    const results: Array<{
      date: string;
      meals: {
        breakfast: {
          state: string;
          locked: boolean;
          food: string | null;
          consumed: boolean;
        };
        lunch: {
          state: string;
          locked: boolean;
          food: string | null;
          consumed: boolean;
        };
        snacks: {
          state: string;
          locked: boolean;
          food: string | null;
          consumed: boolean;
        };
        dinner: {
          state: string;
          locked: boolean;
          food: string | null;
          consumed: boolean;
        };
      };
      createdAt?: Date | string;
    }> = [];
    const startMoment = dayjs(startDateKey).tz("Asia/Kolkata");

    // Pre-compute cutoff checks for all dates and meals
    const cutoffMap = new Map<string, boolean>();
    const currentIST = dayjs().tz("Asia/Kolkata");

    const mealDefaults = {
      breakfast: { dayOffset: -1, time: "21:00" },
      lunch: { dayOffset: 0, time: "08:00" },
      snacks: { dayOffset: 0, time: "13:00" },
      dinner: { dayOffset: 0, time: "16:00" },
    };

    for (let i = 0; i < iterations; i++) {
      const currentDate = startMoment.add(i, "days");
      const dateKey = currentDate.format("YYYY-MM-DD");

      for (const mealName of [
        "breakfast",
        "lunch",
        "snacks",
        "dinner",
      ] as const) {
        let dayOffset: number = mealDefaults[mealName].dayOffset;
        let time: string = mealDefaults[mealName].time;

        if (policy?.bookingCutoffs?.[mealName]) {
          dayOffset = policy.bookingCutoffs[mealName].dayOffset;
          time = policy.bookingCutoffs[mealName].time;
        }

        const [hours, mins] = time.split(":").map(Number);
        const cutoffTime = currentDate
          .clone()
          .add(dayOffset, "day")
          .hour(hours)
          .minute(mins)
          .second(0)
          .millisecond(0);

        const isPassed = currentIST.isAfter(cutoffTime);
        cutoffMap.set(`${dateKey}_${mealName}`, isPassed);
      }
    }

    for (let i = 0; i < iterations; i++) {
      const currentDate = startMoment.clone().add(i, "days");
      const dateKey = currentDate.format("YYYY-MM-DD");

      const booking = bookingMap.get(dateKey);
      const menu = menuMap.get(dateKey);

      const dayResult: (typeof results)[number] = {
        date: dateKey,
        meals: {
          breakfast: { state: "", locked: false, food: null, consumed: false },
          lunch: { state: "", locked: false, food: null, consumed: false },
          snacks: { state: "", locked: false, food: null, consumed: false },
          dinner: { state: "", locked: false, food: null, consumed: false },
        },
      };

      for (const meal of ["breakfast", "lunch", "snacks", "dinner"] as const) {
        const mealStateObj = booking?.meals?.[meal];
        const currentStatus = mealStateObj?.status || MealBookingIntent.PENDING;
        const dbLocked = mealStateObj?.locked || false;

        // Use precomputed cutoff lock
        const isLockedCalc = cutoffMap.get(`${dateKey}_${meal}`) || false;
        const finalLocked = dbLocked || isLockedCalc;

        const isConsumed = mealStateObj?.consumed || false;
        const foodExists = menu && menu[meal] && menu[meal].trim() !== "";
        let displayStatus = currentStatus;

        // Granular Leave Check (Meal Start Time)
        let isMealOnLeave = false;
        const rawStartTime = rawMealTimings[meal];
        if (rawStartTime && leaveRanges.length > 0) {
          const [h, m] = rawStartTime.split(":").map(Number);
          const mealStartMoment = currentDate
            .clone()
            .set("hour", h)
            .set("minute", m)
            .set("second", 0)
            .set("millisecond", 0);

          isMealOnLeave = leaveRanges.some(({ start, end }) => {
            return (
              mealStartMoment.isAfter(start) && mealStartMoment.isBefore(end)
            );
          });
        }

        if (!foodExists) {
          displayStatus = MealBookingIntent.NOT_APPLICABLE;
        } else if (
          isMealOnLeave &&
          (displayStatus === MealBookingIntent.PENDING ||
            displayStatus === MealBookingIntent.CONFIRMED)
        ) {
          displayStatus = MealBookingIntent.SKIPPED;
        }

        dayResult.meals[meal] = {
          state: displayStatus,
          locked: finalLocked,
          food: menu ? menu[meal] || null : null,
          consumed: isConsumed,
        };
      }

      // Attach creation timestamp if booking exists
      if (booking && booking.createdAt) {
        dayResult.createdAt = booking.createdAt;
      }

      results.push(dayResult);
    }
    return { results, mealTimings };
  };

  /**
   * Auto-booking engine (Production Refined):
   * Books all 4 meals for eligible students for the NEXT day.
   * Runs daily at 12:00 PM IST via Cron.
   * Logic: Converts PENDING -> CONFIRMED and Sets locked = true.
   */

  autoBookMealsForNextDay = async (): Promise<void> => {
    // Current Time in IST
    const nowIST = dayjs().tz("Asia/Kolkata");
    const startTimeIST = nowIST.format();
    console.log(`[AutoBooking] Job started at ${startTimeIST} (Asia/Kolkata)`);

    try {
      const targetDateIST = nowIST.add(1, "day").startOf("day");
      const targetDateKey = targetDateIST.format("YYYY-MM-DD");

      // Use UTC midnight for database queries to match how menu dates are stored
      const targetDateUTC = dayjs.utc(targetDateKey).toDate();

      console.log(`[AutoBooking] Target Date (Tomorrow IST): ${targetDateKey}`);

      // Fetch all active hostels
      const hostels = await Hostel.find({ status: true })
        .select("_id name")
        .lean();

      let stats = {
        totalStudents: 0,
        hostelsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        skippedManual: 0,
        skippedExisting: 0,
        skippedNoMenu: 0,
      };

      for (const hostel of hostels) {
        const hostelId = hostel._id;
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Fetch Menu
          const startOfDay = targetDateIST.toDate();
          const endOfDay = targetDateIST.endOf("day").toDate();

          const menu = await MessMenu.findOne({
            hostelId,
            date: { $gte: startOfDay, $lte: endOfDay },
            status: true,
          }).lean();

          if (!menu) {
            stats.skippedNoMenu++;
            await session.abortTransaction();
            session.endSession();
            continue;
          }

          // Fetch Active Students
          const activeStudents = await User.find({
            hostelId,
            status: true,
          })
            .select("_id")
            .lean();
          const studentIds = activeStudents.map((u) => u._id);

          if (studentIds.length === 0) {
            await session.abortTransaction();
            session.endSession();
            continue;
          }

          // Fetch Approved Leaves
          const leaves = await StudentLeave.find({
            userId: { $in: studentIds },
            leaveStatus: LeaveStatusTypes.APPROVED,
            startDate: { $lte: targetDateUTC },
            endDate: { $gte: targetDateUTC },
          })
            .select("userId")
            .lean();
          const leaveStudentIds = new Set(
            leaves.map((l) => l.userId.toString())
          );

          // Fetch Existing Bookings (Manual OR Auto)
          // We must skip these to ensure idempotency and not overwrite manual changes
          const existingBookings = await BookMeals.find({
            hostelId,
            studentId: { $in: studentIds },
            date: targetDateUTC,
          })
            .select("studentId meals isManualBooking")
            .lean();

          const existingBookingsMap = new Map();
          existingBookings.forEach((b: any) =>
            existingBookingsMap.set(b.studentId.toString(), b)
          );

          // Prepare Bulk Operations
          const bulkOps: any[] = [];

          for (const studentIdObj of studentIds) {
            const studentId = studentIdObj.toString();
            stats.totalStudents++;

            const existing = existingBookingsMap.get(studentId);

            if (existing) {
              // Check if we can confirm any PENDING meals?
              let hasUpdates = false;
              const updatedMeals = existing.meals ? { ...existing.meals } : {};

              for (const meal of [
                "breakfast",
                "lunch",
                "snacks",
                "dinner",
              ] as const) {
                if (!updatedMeals[meal]) continue;

                // Force Confirm for any PENDING meal found in existing system record
                if (updatedMeals[meal].status === MealBookingIntent.PENDING) {
                  updatedMeals[meal].status = MealBookingIntent.CONFIRMED;
                  updatedMeals[meal].locked = false;
                  hasUpdates = true;
                }
              }

              if (hasUpdates) {
                bulkOps.push({
                  updateOne: {
                    filter: { _id: existing._id },
                    update: {
                      $set: {
                        meals: updatedMeals,
                        updatedAt: nowIST.toDate(),
                      },
                    },
                  },
                });
                stats.recordsUpdated++;
              } else {
                stats.skippedExisting++;
              }
              continue;
            }

            const hasLeave = leaveStudentIds.has(studentId);

            const newMeals: any = {};
            const mealNames = [
              "breakfast",
              "lunch",
              "snacks",
              "dinner",
            ] as const;

            for (const meal of mealNames) {
              let status = MealBookingIntent.PENDING;
              let locked = false;

              // If menu doesn't exist for this meal
              if (!menu[meal] || menu[meal].trim() === "") {
                status = MealBookingIntent.NOT_APPLICABLE;
                locked = true;
              } else if (hasLeave) {
                // Determine leave status - usually SKIPPED or CANCELLED
                status = MealBookingIntent.SKIPPED;
                locked = false;
              } else {
                // Auto-confirm without cutoff check (Cron runs early)
                status = MealBookingIntent.CONFIRMED;
                locked = false; // Allow cancellation until actual cutoff
              }

              newMeals[meal] = {
                status: status,
                locked: locked,
                consumed: false,
                consumedAt: null,
                cancelSource: hasLeave ? MealCancelSource.LEAVE : null,
              };
            }

            // Prepare Insert

            bulkOps.push({
              insertOne: {
                document: {
                  mealId: menu._id,
                  hostelId,
                  studentId: studentIdObj,
                  date: targetDateUTC,
                  meals: newMeals,
                  isManualBooking: false,
                  createdBy: studentIdObj,
                  createdAt: nowIST.toDate(),
                  updatedAt: nowIST.toDate(),
                },
              },
            });
            stats.recordsCreated++;
          }

          if (bulkOps.length > 0) {
            await BookMeals.bulkWrite(bulkOps, { session });
          }

          await session.commitTransaction();
          stats.hostelsProcessed++;
        } catch (err: any) {
          await session.abortTransaction();
          console.error(
            `[AutoBooking] Error processing hostel ${hostel.name}:`,
            err.message
          );
        } finally {
          session.endSession();
        }
      }

      console.log("[AutoBooking] Completed.", stats);
    } catch (error: any) {
      console.error("[AutoBooking] Failed:", error.message);
    }
  };

  //-----------------------warden methods-----------------------

  // SECTION: Method to get meal state analytics by date
  getMealStateAnalyticsByDate = async (
    hostelId: string,
    date: string | Date
  ): Promise<any> => {
    interface MealStateAnalyticsResponse {
      date: string;
      hostelId: string;
      meals: {
        breakfast: { booked: number; skipped: number; pending: number };
        lunch: { booked: number; skipped: number; pending: number };
        snacks: { booked: number; skipped: number; pending: number };
        dinner: { booked: number; skipped: number; pending: number };
      };
      totalStudents: number;
    }

    try {
      if (!hostelId) throw new Error("Hostel Id is required");
      if (!date) throw new Error("Date is required");

      const targetDateIST = dayjs.tz(date, "Asia/Kolkata");
      // Explicit conversion to UTC for MongoDB query
      const startOfDay = targetDateIST.startOf("day").utc().toDate();
      const endOfDay = targetDateIST.endOf("day").utc().toDate();

      // Get Total Students in the Hostel (Active & Verified)
      const totalStudents = await User.countDocuments({
        hostelId: new mongoose.Types.ObjectId(hostelId),
        isVerified: true,
        status: true,
      });

      // NOTE: Pending Calculation Assumption
      // Pending = totalStudents - (CONFIRMED + SKIPPED)
      // Students without booking records for the date are treated as PENDING.

      // Use MongoDB aggregation for counting confirmed and skipped meals
      const counts = await BookMeals.aggregate([
        {
          $match: {
            hostelId: new mongoose.Types.ObjectId(hostelId),
            date: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        {
          $group: {
            _id: null,
            breakfastBooked: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$meals.breakfast.status",
                      MealBookingIntent.CONFIRMED,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            breakfastSkipped: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$meals.breakfast.status", MealBookingIntent.SKIPPED],
                  },
                  1,
                  0,
                ],
              },
            },
            lunchBooked: {
              $sum: {
                $cond: [
                  { $eq: ["$meals.lunch.status", MealBookingIntent.CONFIRMED] },
                  1,
                  0,
                ],
              },
            },
            lunchSkipped: {
              $sum: {
                $cond: [
                  { $eq: ["$meals.lunch.status", MealBookingIntent.SKIPPED] },
                  1,
                  0,
                ],
              },
            },
            snacksBooked: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$meals.snacks.status", MealBookingIntent.CONFIRMED],
                  },
                  1,
                  0,
                ],
              },
            },
            snacksSkipped: {
              $sum: {
                $cond: [
                  { $eq: ["$meals.snacks.status", MealBookingIntent.SKIPPED] },
                  1,
                  0,
                ],
              },
            },
            dinnerBooked: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$meals.dinner.status", MealBookingIntent.CONFIRMED],
                  },
                  1,
                  0,
                ],
              },
            },
            dinnerSkipped: {
              $sum: {
                $cond: [
                  { $eq: ["$meals.dinner.status", MealBookingIntent.SKIPPED] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      const c = counts[0] || {
        breakfastBooked: 0,
        breakfastSkipped: 0,
        lunchBooked: 0,
        lunchSkipped: 0,
        snacksBooked: 0,
        snacksSkipped: 0,
        dinnerBooked: 0,
        dinnerSkipped: 0,
      };

      // Calculate Response
      const response: MealStateAnalyticsResponse = {
        date: formatDateOnly(targetDateIST.toDate()),
        hostelId,
        meals: {
          breakfast: {
            booked: c.breakfastBooked,
            skipped: c.breakfastSkipped,
            pending: Math.max(
              0,
              totalStudents - c.breakfastBooked - c.breakfastSkipped
            ),
          },
          lunch: {
            booked: c.lunchBooked,
            skipped: c.lunchSkipped,
            pending: Math.max(
              0,
              totalStudents - c.lunchBooked - c.lunchSkipped
            ),
          },
          snacks: {
            booked: c.snacksBooked,
            skipped: c.snacksSkipped,
            pending: Math.max(
              0,
              totalStudents - c.snacksBooked - c.snacksSkipped
            ),
          },
          dinner: {
            booked: c.dinnerBooked,
            skipped: c.dinnerSkipped,
            pending: Math.max(
              0,
              totalStudents - c.dinnerBooked - c.dinnerSkipped
            ),
          },
        },
        totalStudents,
      };

      return response;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  // SECTION: Method to set hostel meal timings
  setHostelMealTiming = async (data: any, userId: string) => {
    try {
      const { hostelId, ...timings } = data;
      const userObjectId = new Types.ObjectId(userId);

      const result = await HostelMealTiming.findOneAndUpdate(
        { hostelId },
        {
          $set: {
            ...timings,
            updatedBy: userObjectId,
            updatedAt: dayjs().tz("Asia/Kolkata").toDate(),
          },
          $setOnInsert: {
            createdAt: dayjs().tz("Asia/Kolkata").toDate(),
            status: true,
            createdBy: userObjectId,
          },
        },
        { upsert: true, new: true, lean: true }
      );

      return result;
    } catch (error: any) {
      throw new Error(`[setHostelMealTiming] Failed: ${error.message}`);
    }
  };

  // SECTION: Method to get hostel meal timings
  getHostelMealTiming = async (hostelId: string) => {
    try {
      const timing = await HostelMealTiming.findOne({
        hostelId,
        status: true,
      }).lean();

      if (timing) return timing;

      return {
        hostelId: new Types.ObjectId(hostelId),
        breakfastStartTime: "07:00",
        breakfastEndTime: "10:00",
        lunchStartTime: "12:00",
        lunchEndTime: "15:30",
        snacksStartTime: "17:00",
        snacksEndTime: "19:00",
        dinnerStartTime: "19:30",
        dinnerEndTime: "21:00",
        status: true,
        isDefault: true,
      };
    } catch (error: any) {
      throw new Error(`[getHostelMealTiming] Failed: ${error.message}`);
    }
  };

  // SECTION: Method to set hostel meal cutoff policies
  setHostelMealCutoff = async (data: any, userId: string) => {
    try {
      const { hostelId, ...bookingCutoffs } = data;
      const userObjectId = new Types.ObjectId(userId);

      // Verify 2-hour gap rule for Lunch, Snacks, Dinner
      // Fetch meal timings for the hostel
      const timings = await HostelMealTiming.findOne({
        hostelId,
        status: true,
      }).lean();
      if (!timings) {
        throw new Error(
          "Meal timings for this hostel must be set before configuring cutoffs."
        );
      }

      const timeToMinutes = (time: string) => {
        const [h, m] = time.split(":").map(Number);
        return h * 60 + m;
      };

      const validateGap = (
        mealName: string,
        startTimeStr: string,
        cutoff: { dayOffset: number; time: string }
      ) => {
        const startMins = timeToMinutes(startTimeStr);
        const cutoffMins = cutoff.dayOffset * 1440 + timeToMinutes(cutoff.time);

        // Gap = startMins - cutoffMins
        if (startMins - cutoffMins < 120) {
          throw new Error(
            `${mealName} cutoff must be at least 2 hours before its start time (${startTimeStr}).`
          );
        }
      };

      if (bookingCutoffs.lunch)
        validateGap("Lunch", timings.lunchStartTime, bookingCutoffs.lunch);
      if (bookingCutoffs.snacks)
        validateGap("Snacks", timings.snacksStartTime, bookingCutoffs.snacks);
      if (bookingCutoffs.dinner)
        validateGap("Dinner", timings.dinnerStartTime, bookingCutoffs.dinner);

      const result = await HostelPolicy.findOneAndUpdate(
        { hostelId },
        {
          $set: {
            bookingCutoffs,
            updatedBy: userObjectId,
            updatedAt: dayjs().tz("Asia/Kolkata").toDate(),
          },
          $setOnInsert: {
            createdAt: dayjs().tz("Asia/Kolkata").toDate(),
            status: true,
            createdBy: userObjectId,
          },
        },
        { upsert: true, new: true, lean: true }
      );

      return result;
    } catch (error: any) {
      throw new Error(`[setHostelMealCutoff] Failed: ${error.message}`);
    }
  };

  // SECTION: Method to get hostel meal cutoff policies
  getHostelMealCutoff = async (hostelId: string) => {
    try {
      const policy = await HostelPolicy.findOne({
        hostelId,
        status: true,
      }).lean();

      if (policy) return policy;

      return {
        hostelId,
        bookingCutoffs: {
          breakfast: { dayOffset: -1, time: "21:00" },
          lunch: { dayOffset: 0, time: "08:00" },
          snacks: { dayOffset: 0, time: "13:00" },
          dinner: { dayOffset: 0, time: "16:00" },
        },
        status: true,
        isDefault: true,
      };
    } catch (error: any) {
      throw new Error(`[getHostelMealCutoff] Failed: ${error.message}`);
    }
  };

  /**
   * SECTION: Warden Meal Reporting - Get student-wise meal status by date
   * Returns paginated list of students with their meal bookings for a specific hostel and date
   * Supports filtering by student status, meal status, floor, room, and text search
   */
  fetchStudentsMealStatusByDate = async (
    params: WardenMealReportingInput
  ): Promise<{
    students: any[];
    pagination: {
      page: number;
      limit: number;
      totalPages: number;
      totalRecords: number;
    };
  }> => {
    try {
      const {
        hostelId: hostelIdStr,
        date,
        filters = {},
        search = {},
        pagination = { page: 1, limit: 10 },
        sort = { field: "name", order: "asc" },
      } = params;

      const hostelId = new Types.ObjectId(hostelIdStr);

      // Date Sanitization (Normalization to UTC Range)
      const targetDateIST = dayjs.tz(date, "Asia/Kolkata").startOf("day");
      const startOfDay = targetDateIST.utc().toDate();
      const endOfDay = targetDateIST.endOf("day").utc().toDate();

      // Pagination & Sorting Guardrails
      const page = pagination?.page || 1;
      const limit = Math.min(pagination?.limit || 10, 50);

      const sortFieldMapping: Record<string, string> = {
        uniqueId: "student.uniqueId",
        name: "student.name",
        floorNumber: "floorNumber",
        roomNumber: "roomNumber",
      };

      const sortField = sortFieldMapping[sort?.field] || "student.name";
      const sortOrder = sort?.order === "asc" ? -1 : 1;

      const pipeline: PipelineStage[] = [];

      // STAGE 1: Base Match (Student Hostel Allocations)
      // NOTE: We start with allocations to ensure we only report on students assigned to this hostel.
      // 'status: true' filters for active allocations (non-cancelled/non-expired records).
      pipeline.push({
        $match: {
          hostelId,
          status: true,
        },
      });

      // STAGE 2: User Detail Lookup
      pipeline.push({
        $lookup: {
          from: "users",
          localField: "studentId",
          foreignField: "_id",
          as: "student",
        },
      });
      pipeline.push({ $unwind: "$student" });

      // STAGE 3: Student Status Filtering
      const targetStatus = filters?.studentStatus;
      if (targetStatus === "ACTIVE") {
        pipeline.push({
          $match: {
            "student.status": true,
            "student.isLeft": false,
          },
        });
      } else if (targetStatus === "INACTIVE") {
        pipeline.push({
          $match: {
            $or: [{ "student.status": false }, { "student.isLeft": true }],
          },
        });
      }

      // STAGE 4: Meal Booking Lookup
      pipeline.push({
        $lookup: {
          from: "bookmeals",
          let: { studentId: "$studentId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$studentId", "$$studentId"] },
                    { $gte: ["$date", startOfDay] },
                    { $lte: ["$date", endOfDay] },
                  ],
                },
              },
            },
          ],
          as: "booking",
        },
      });
      pipeline.push({
        $unwind: { path: "$booking", preserveNullAndEmptyArrays: true },
      });

      // STAGE 5: Construct Meal Objects with Raw Status & Consumed
      // We directly project the status and consumed fields from the booking.
      pipeline.push({
        $addFields: {
          "meals.breakfast": {
            status: {
              $ifNull: [
                `$booking.meals.breakfast.status`,
                MealBookingIntent.PENDING,
              ],
            },
            consumed: { $ifNull: [`$booking.meals.breakfast.consumed`, false] },
          },
          "meals.lunch": {
            status: {
              $ifNull: [
                `$booking.meals.lunch.status`,
                MealBookingIntent.PENDING,
              ],
            },
            consumed: { $ifNull: [`$booking.meals.lunch.consumed`, false] },
          },
          "meals.snacks": {
            status: {
              $ifNull: [
                `$booking.meals.snacks.status`,
                MealBookingIntent.PENDING,
              ],
            },
            consumed: { $ifNull: [`$booking.meals.snacks.consumed`, false] },
          },
          "meals.dinner": {
            status: {
              $ifNull: [
                `$booking.meals.dinner.status`,
                MealBookingIntent.PENDING,
              ],
            },
            consumed: { $ifNull: [`$booking.meals.dinner.consumed`, false] },
          },
        },
      });

      // STAGE 5.1: Calculate Derived Status for Filtering
      // We calculate a status that matches the filter options: "Confirmed", "Cancelled", "Missed", "Cancelled-Consumed"
      const currentDayStart = dayjs().tz("Asia/Kolkata").startOf("day");
      const isPastDate = targetDateIST.isBefore(currentDayStart);

      const deriveStatusExpression = (statusField: string, consumedField: string) => {
        return {
          $switch: {
            branches: [
              // Case 1: Cancelled/Skipped & Consumed
              {
                case: {
                  $and: [
                    {
                      $or: [
                        { $eq: [statusField, MealBookingIntent.CANCELLED] },
                        { $eq: [statusField, MealBookingIntent.SKIPPED] },
                      ],
                    },
                    { $eq: [consumedField, true] },
                  ],
                },
                then: "Cancelled-Consumed",
              },
              // Case 2: Cancelled/Skipped
              {
                case: {
                  $or: [
                    { $eq: [statusField, MealBookingIntent.CANCELLED] },
                    { $eq: [statusField, MealBookingIntent.SKIPPED] },
                  ],
                },
                then: "Cancelled",
              },
              // Case 3: Missed (Confirmed + Not Consumed) - User requested strict definition
              {
                case: {
                  $and: [
                    { $eq: [statusField, MealBookingIntent.CONFIRMED] },
                    { $eq: [consumedField, false] },
                    isPastDate,
                  ],
                },
                then: "Missed",
              },
              // Case 4: Confirmed (Everything else Confirmed)
              {
                case: { $eq: [statusField, MealBookingIntent.CONFIRMED] },
                then: "Confirmed",
              },
            ],
            default: "Other", // PENDING, SKIPPED, or N/A
          },
        };
      };

      pipeline.push({
        $addFields: {
          "meals.breakfast.derivedStatus": deriveStatusExpression(
            "$meals.breakfast.status",
            "$meals.breakfast.consumed"
          ),
          "meals.lunch.derivedStatus": deriveStatusExpression(
            "$meals.lunch.status",
            "$meals.lunch.consumed"
          ),
          "meals.snacks.derivedStatus": deriveStatusExpression(
            "$meals.snacks.status",
            "$meals.snacks.consumed"
          ),
          "meals.dinner.derivedStatus": deriveStatusExpression(
            "$meals.dinner.status",
            "$meals.dinner.consumed"
          ),
        },
      });

      // Meal Status Filtering
      if (filters?.mealStatus && filters.mealStatus.length > 0) {
        pipeline.push({
          $match: {
            $or: [
              { "meals.breakfast.derivedStatus": { $in: filters.mealStatus } },
              { "meals.lunch.derivedStatus": { $in: filters.mealStatus } },
              { "meals.snacks.derivedStatus": { $in: filters.mealStatus } },
              { "meals.dinner.derivedStatus": { $in: filters.mealStatus } },
            ],
          },
        });
      }


      // STAGE 6: Room/Floor & Meal Status Filtering
      if (filters?.floor !== undefined) {
        pipeline.push({ $match: { floorNumber: filters.floor } });
      }
      if (filters?.room !== undefined) {
        pipeline.push({ $match: { roomNumber: filters.room } });
      }

      // STAGE 7: Text Search
      if (search?.text && search.text.trim()) {
        const regex = new RegExp(
          search.text.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        );
        pipeline.push({
          $match: {
            $or: [{ "student.uniqueId": regex }, { "student.name": regex }],
          },
        });
      }

      // STAGE 8: Sorting & Final Projection
      pipeline.push({ $sort: { [sortField]: sortOrder } });
      pipeline.push({
        $project: {
          _id: 0,
          studentId: "$studentId",
          image: "$student.image",
          uniqueId: "$student.uniqueId",
          name: "$student.name",
          phone: { $toString: "$student.phone" },
          roomNumber: 1,
          floorNumber: 1,
          meals: 1,
        },
      });

      // STAGE 9: Paginate using project utility
      const { data, count } = await paginateAggregate(
        StudentHostelAllocation,
        pipeline,
        page,
        limit
      );

      return {
        students: data,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(count / limit),
          totalRecords: count,
        },
      };
    } catch (error: any) {
      throw new Error(
        `MealReportingService: Failed to fetch student meal status. Detail: ${error.message}`
      );
    }
  };
}

export default new MessService();
