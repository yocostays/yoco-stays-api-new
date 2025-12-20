import mongoose from "mongoose";
import { formatDateOnly, getDateRange, populateTemplate } from "../utils/lib";
import MessMenu from "../models/messMenu.model";
import BulkUpload from "../models/bulkUpload.model";
import Hostel from "../models/hostel.model";
import BookMeals from "../models/bookMeal.model";
import User from "../models/user.model";
import Notice from "../models/notice.model";
import StudentHostelAllocation from "../models/studentHostelAllocation.model";
import { getSignedUrl, pushToS3Bucket } from "../utils/awsUploadService";
import { MESS_BULK_UPLOAD_FILES } from "../utils/s3bucketFolder";
import UserService from "./user.service";

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
} from "../utils/enum";
import { sendPushNotificationToUser } from "../utils/commonService/pushNotificationService";


const { RECORD_NOT_FOUND, START_DATE_ERROR, NO_DATA_IN_GIVEN_DATE } = ERROR_MESSAGES;
const { CREATE_DATA, DELETE_DATA, UPDATE_DATA, MEAL_CANCELLED } =
  SUCCESS_MESSAGES;
const { MESS_MENU_ALREADY_EXIST, INVALID_REPORT_TYPE } = VALIDATION_MESSAGES;
const { fetchPlayerNotificationConfig, getStudentAllocatedHostelDetails } =
  UserService;

//SECTION: Interface for Booking Request
export interface IBookingRequest {
  date: string | Date;
  isBreakfastBooked: boolean;
  isLunchBooked: boolean;
  isDinnerBooked: boolean;
  isSnacksBooked: boolean;
  bookingStatus?: MealBookingStatusTypes;
}

class MessService {
  //SECTION: Method to create a mess menu for hostel
  messMenuCreationForHostel = async (
    hostelId: string,
    fromDate: Date,
    toDate: Date,
    breakfast: string,
    lunch: string,
    snacks: string,
    dinner: string,
    createdById?: string
  ): Promise<string> => {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      if (new Date(fromDate) < today) throw new Error(START_DATE_ERROR);

      // Check if the hostel exists
      const existingHostel = await Hostel.exists({ _id: hostelId });
      if (!existingHostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      // Get all dates between fromDate and toDate
      const dates = getDatesBetween(new Date(fromDate), new Date(toDate));

      // Process all dates sequentially using a for loop
      for (const date of dates) {
        // Normalize the date to UTC midnight
        const normalizedDate = new Date(date);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        const dayOfWeek = getDayOfWeek(normalizedDate);

        const existingMenu: any = await MessMenu.findOne({
          hostelId,
          date: normalizedDate,
        });

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
        }
      }

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get all mess menu
  messMenuWithPagination = async (
    page: number,
    limit: number,
    hostelId?: string,
    mealType?: MealCountReportType,
    sort?: SortingTypes,
    startDate?: string,
    endDate?: string
  ): Promise<{ data: any[]; count: number }> => {
    try {
      const skip = (page - 1) * limit;
      const sortOptions: any = {};
      const searchParams: any = {};

      if (hostelId) {
        searchParams.hostelId = hostelId;
      }

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

      if (mealType !== MealCountReportType.ALL) {
        searchParams.$or = [];
        if (mealType === MealCountReportType.BREAKFAST) {
          searchParams.$or.push({ breakfast: { $exists: true, $ne: null } });
        }
        if (mealType === MealCountReportType.LUNCH) {
          searchParams.$or.push({ lunch: { $exists: true, $ne: null } });
        }
        if (mealType === MealCountReportType.DINNER) {
          searchParams.$or.push({ dinner: { $exists: true, $ne: null } });
        }
        if (mealType === MealCountReportType.HI_TEA) {
          searchParams.$or.push({ snacks: { $exists: true, $ne: null } });
        }
      }
      const [count, messMenuDetails] = await Promise.all([
        MessMenu.countDocuments(searchParams),
        MessMenu.find(searchParams)
          .populate([
            { path: "hostelId", select: "name" },
            { path: "createdBy", select: "name" },
          ])
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      const result = await Promise.all(
        messMenuDetails.map(async (menu: any) => {
          return {
            _id: menu._id,
            uniqueId: menu.uniqueId ?? null,
            hostelId: menu.hostelId?._id ?? null,
            hostelName: (menu?.hostelId as any)?.name ?? null,
            date: menu.date ?? null,
            day: menu.day ?? null,
            breakfast:
              mealType === MealCountReportType.ALL ||
                mealType === MealCountReportType.BREAKFAST
                ? menu.breakfast ?? null
                : null,
            lunch:
              mealType === MealCountReportType.ALL ||
                mealType === MealCountReportType.LUNCH
                ? menu.lunch ?? null
                : null,
            dinner:
              mealType === MealCountReportType.ALL ||
                mealType === MealCountReportType.DINNER
                ? menu.dinner ?? null
                : null,
            snacks:
              mealType === MealCountReportType.ALL ||
                mealType === MealCountReportType.HI_TEA
                ? menu.snacks ?? null
                : null,
            status: menu.status ?? null,
            createdBy: (menu?.createdBy as any)?.name ?? null,
            createdAt: menu.createdAt ?? null,
            totalBooking: menu.totalBooking ?? 0,
            totalCancelled: menu.totalCancelled ?? 0,
            totalConsumed: menu.totalConsumed ?? 0,
          };
        })
      );

      return { data: result, count };
    } catch (error: any) {
      throw new Error(error.message);
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
    mealDate?: Date
  ): Promise<{ messDetails: any }> => {
    try {
      const hostel = await Hostel.exists({ _id: hostelId });

      if (!hostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      // Check if date is provided; if not, use today's date
      const queryDate = mealDate ? new Date(mealDate) : getCurrentISTTime();
      queryDate.setUTCHours(0, 0, 0, 0);

      // Get today's menu based on the provided or current date
      const menu = await MessMenu.findOne({
        hostelId,
        date: queryDate,
      }).select("date breakfast lunch snacks dinner");

      if (!menu) {
        throw new Error(
          `No menu found for the date: ${queryDate.toDateString()}`
        );
      }

      return { messDetails: menu };
    } catch (error: any) {
      throw new Error(`Failed to retrieve menu: ${error.message}`);
    }
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
  cancelledMealHistory = async (
    hostelId: string,
    studentId: string,
    status: MealBookingStatusTypes
  ): Promise<{ cancelMeal: any[] }> => {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const hostel = await Hostel.exists({ _id: hostelId });

      if (!hostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      // Build the query based on the status
      const query: any = {
        hostelId,
        studentId,
      };

      if (status === MealBookingStatusTypes.BOOKED) {
        query.bookingStatus = {
          $in: [
            MealBookingStatusTypes.BOOKED,
            MealBookingStatusTypes.PARTIALLY_CANCELLED,
          ],
        };
      } else {
        query.bookingStatus = MealBookingStatusTypes.CANCELLED;
      }

      // Get meals that are not booked (cancelled)
      const meals = await BookMeals.find(query).select(
        "date isBreakfastBooked isLunchBooked isDinnerBooked isSnacksBooked cancellationReason bookingStatus"
      );

      if (!meals || meals.length === 0) {
        return { cancelMeal: [] };
      }

      // Transform each meal into the desired response format
      const response = meals.map((meal) => ({
        _id: meal._id,
        date: meal.date ?? null,
        canUndoBooking: meal.date <= today ? false : true,
        editBooking: meal.date <= today ? false : true,
        breakfast: !!meal.isBreakfastBooked,
        lunch: !!meal.isLunchBooked,
        dinner: !!meal.isDinnerBooked,
        snacks: !!meal.isSnacksBooked,
        cancellationReason: meal.cancellationReason ?? null,
        bookingStatus: meal.bookingStatus ?? null,
      }));

      return { cancelMeal: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

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
}

export default new MessService();
