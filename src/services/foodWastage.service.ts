import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
import FoodWastage from "../models/foodWastage.model";
import Hostel from "../models/hostel.model";
import MessMenu from "../models/messMenu.model";
import HostelMealTiming from "../models/hostelMealTiming.model";
import BulkUpload from "../models/bulkUpload.model";
import { pushToS3Bucket } from "../utils/awsUploadService";
import { FOOD_WASTAGE_BULK_UPLOAD_FILES } from "../utils/s3bucketFolder";
import {
  VALIDATION_MESSAGES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { BulkUploadTypes, UnitTypes } from "../utils/enum";
import {
  getDatesBetween,
  getCurrentISTTime,
  aggregateMealAmounts,
  excelDateToJSDate,
  groupDataByDate,
} from "../utils/lib";

const { SAME_DATE } = VALIDATION_MESSAGES;
const { CREATE_DATA, UPDATE_DATA, DELETE_DATA } = SUCCESS_MESSAGES;
const { RECORD_NOT_FOUND, NO_DATA_IN_GIVEN_DATE } = ERROR_MESSAGES;

class FoodWastageService {
  createFoodWastage = async (
    date: Date | string,
    breakfast: { amount: number; unit: UnitTypes } | undefined,
    lunch: { amount: number; unit: UnitTypes } | undefined,
    snacks: { amount: number; unit: UnitTypes } | undefined,
    dinner: { amount: number; unit: UnitTypes } | undefined,
    hostelId: string,
    createdById: string
  ): Promise<string> => {
    try {
      const inputDate = dayjs(date).tz("Asia/Kolkata").startOf("day");
      const today = dayjs().tz("Asia/Kolkata").startOf("day");

      if (inputDate.isAfter(today)) {
        throw new Error("Cannot record food wastage for future dates");
      }

      const normalizedDate = dayjs.utc(date).startOf("day").toDate();

      // Parallel Data Fetching
      const [timings, hostelExists, existingRecord] = await Promise.all([
        HostelMealTiming.findOne({ hostelId, status: true }).lean(),
        Hostel.exists({ _id: hostelId }),
        FoodWastage.findOne({
          hostelId,
          date: {
            $gte: dayjs.utc(normalizedDate).subtract(6, "hours").toDate(),
            $lte: dayjs.utc(normalizedDate).add(18, "hours").toDate(),
          },
        }).lean()
      ]);

      if (!hostelExists) throw new Error(RECORD_NOT_FOUND("Hostel"));

      // Validate meal end times (Internal Method) using fetched timings
      this.checkMealEndTimeInPlace(timings, date, { breakfast, lunch, snacks, dinner });

      // Validate mess menu using single date helper
      const mealIds = await this.validateMessMenuSingleDate(
        normalizedDate,
        hostelId,
        {
          breakfast,
          lunch,
          snacks,
          dinner,
        }
      );

      const finalBreakfast = breakfast
        ? { ...breakfast, unit: UnitTypes.G }
        : existingRecord
          ? (existingRecord as any).breakfast
          : null;
      const finalLunch = lunch
        ? { ...lunch, unit: UnitTypes.G }
        : existingRecord
          ? (existingRecord as any).lunch
          : null;
      const finalSnacks = snacks
        ? { ...snacks, unit: UnitTypes.G }
        : existingRecord
          ? (existingRecord as any).snacks
          : null;
      const finalDinner = dinner
        ? { ...dinner, unit: UnitTypes.G }
        : existingRecord
          ? (existingRecord as any).dinner
          : null;

      // Aggregate meal wastage strictly in grams from final state
      const totalAmount =
        (finalBreakfast?.amount || 0) +
        (finalLunch?.amount || 0) +
        (finalSnacks?.amount || 0) +
        (finalDinner?.amount || 0);

      const updateData = {
        mealIds,
        date: normalizedDate,
        breakfast: finalBreakfast,
        lunch: finalLunch,
        snacks: finalSnacks,
        dinner: finalDinner,
        hostelId,
        totalWastage: totalAmount,
        totalUnit: UnitTypes.G,
        updatedAt: getCurrentISTTime(),
      };

      if (existingRecord) {
        // Perform Update
        await FoodWastage.findByIdAndUpdate(existingRecord._id, {
          $set: {
            ...updateData,
            updatedBy: createdById,
          },
        });
        return UPDATE_DATA;
      } else {
        // Perform Create
        const foodWastageNumber = await this.generateFoodWastageNumber();
        await FoodWastage.create({
          ...updateData,
          foodWastageNumber,
          createdBy: createdById,
          createdAt: getCurrentISTTime(),
        });
        return CREATE_DATA;
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get all FoodWastage report
  // getAllFoodWastage = async (
  //   page: number,
  //   limit: number,
  //   mealType: MealCountReportType,
  //   sort?: SortingTypes,
  //   hostelId?: string,
  //   startDate?: string,
  //   endDate?: string
  // ): Promise<{ data: any[]; count: number }> => {
  //   try {
  //     const skip = (page - 1) * limit;
  //     const hostelIdParams = hostelId ? { hostelId } : {};

  //     // Sorting logic
  //     const sortOptions: any = { createdAt: -1 };
  //     let searchParams: any = {};

  //   if (sort === SortingTypes.CUSTOM && startDate && endDate) {
  //     const start = new Date(startDate);
  //     start.setUTCHours(0, 0, 0, 0);

  //     const end = new Date(endDate);
  //     end.setUTCHours(23, 59, 59, 999);

  //     searchParams = { date: { $gte: start, $lte: end } };
  //   }

  //   // Meal type filter dynamically
  //   const mealFields: Record<string, any> = {
  //     [MealCountReportType.BREAKFAST]: "breakfast",
  //     [MealCountReportType.LUNCH]: "lunch",
  //     [MealCountReportType.DINNER]: "dinner",
  //     [MealCountReportType.HI_TEA]: "snacks",
  //   };

  //   const searchMealTypes =
  //     mealType !== MealCountReportType.ALL
  //       ? { [mealFields[mealType]]: { $ne: null } }
  //       : {};

  //   // Fetch data in parallel
  //   const [count, foodWastage] = await Promise.all([
  //     FoodWastage.countDocuments({
  //       ...searchMealTypes,
  //       ...hostelIdParams,
  //       ...searchParams,
  //     }),
  //     FoodWastage.find({
  //       ...searchMealTypes,
  //       ...hostelIdParams,
  //       ...searchParams,
  //     })
  //       .populate([
  //         { path: "createdBy", select: "name" },
  //         { path: "hostelId", select: "name" },
  //       ])
  //       .sort(sortOptions)
  //       .skip(skip)
  //       .limit(limit),
  //   ]);

  //   // Map response dynamically
  //   const response = foodWastage.map((ele: any) => {
  //     const baseData = {
  //       _id: ele._id,
  //       foodWastageNumber: ele.foodWastageNumber ?? null,
  //       date: ele?.date ?? null,
  //       hostelId: ele?.hostelId?._id ?? null,
  //       hostelName: ele?.hostelId?.name ?? null,
  //       totalWastage: ele?.totalWastage ?? null,
  //       totalUnit: ele?.totalUnit ?? null,
  //       feedback: 0,
  //       createdBy: ele?.createdBy?.name ?? null,
  //       createdAt: ele?.createdAt ?? null,
  //     };

  //     // Dynamically assign meal fields based on mealType
  //     return {
  //       ...baseData,
  //       ...Object.fromEntries(
  //         Object.entries(mealFields).map(([key, field]) => [
  //           field,
  //           mealType === MealCountReportType.ALL || mealType === key
  //             ? ele?.[field]
  //               ? `${ele[field].amount ?? 0} ${ele[field].unit ?? ""}`
  //               : null
  //             : null,
  //         ])
  //       ),
  //     };
  //   });

  //   return { data: response, count };
  //   } catch (error: any) {
  //     throw new Error(error.message);
  //   }
  // };

  //SECTION: Method to get FoodWastage by id
  async getFoodWastageById(id: string): Promise<{ data: any }> {
    try {
      const foodWastage = await FoodWastage.findById(id)
        .populate([{ path: "hostelId", select: "name" }])
        .select("-createdBy -updatedBy -createdAt -updatedAt -__v");

      if (!foodWastage) throw new Error(RECORD_NOT_FOUND("Food Wastage"));

      return { data: foodWastage };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to update FoodWastage report
  updateFoodWastage = async (
    id: string,
    date: Date | string,
    breakfast: { amount: number; unit: UnitTypes } | undefined,
    lunch: { amount: number; unit: UnitTypes } | undefined,
    snacks: { amount: number; unit: UnitTypes } | undefined,
    dinner: { amount: number; unit: UnitTypes } | undefined,
    hostelId: string,
    updatedById: string
  ): Promise<string> => {
    try {
      const normalizedDate = dayjs(date).startOf("day").toDate();
      const today = dayjs().tz("Asia/Kolkata").startOf("day");

      if (dayjs(normalizedDate).isAfter(today)) {
        throw new Error("Cannot record food wastage for future dates");
      }

      // Parallel Data Fetching
      const [timings, hostelExists, dateExists] = await Promise.all([
        HostelMealTiming.findOne({ hostelId, status: true }).lean(),
        Hostel.exists({ _id: hostelId }),
        FoodWastage.exists({
          _id: { $ne: id },
          hostelId,
          date: normalizedDate,
        })
      ]);

      if (!hostelExists) throw new Error(RECORD_NOT_FOUND("Hostel"));
      if (dateExists) throw new Error(SAME_DATE);

      // Validate meal end times (Internal Method) using fetched timings
      this.checkMealEndTimeInPlace(timings, date, { breakfast, lunch, snacks, dinner });

      // Validate mess menu using single date helper
      const mealIds = await this.validateMessMenuSingleDate(
        normalizedDate,
        hostelId,
        {
          breakfast,
          lunch,
          snacks,
          dinner,
        }
      );

      // Aggregate meal wastage strictly in grams
      const totalAmount =
        (breakfast?.amount || 0) +
        (lunch?.amount || 0) +
        (snacks?.amount || 0) +
        (dinner?.amount || 0);

      // Update FoodWastage entry
      await FoodWastage.findByIdAndUpdate(id, {
        $set: {
          mealIds,
          date: normalizedDate,
          breakfast: breakfast ? { ...breakfast, unit: UnitTypes.G } : null,
          lunch: lunch ? { ...lunch, unit: UnitTypes.G } : null,
          snacks: snacks ? { ...snacks, unit: UnitTypes.G } : null,
          dinner: dinner ? { ...dinner, unit: UnitTypes.G } : null,
          hostelId,
          totalWastage: totalAmount,
          totalUnit: UnitTypes.G,
          updatedBy: updatedById,
          updatedAt: getCurrentISTTime(),
        },
      });

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to delete FoodWastage by id
  async deleteFoodWastageById(id: string): Promise<string> {
    try {
      const foodWastage = await FoodWastage.findByIdAndDelete(id);
      if (!foodWastage) throw new Error(RECORD_NOT_FOUND("FoodWastage"));
      return DELETE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to bulk uplaod a food wastage  for hostel
  bulkUploadFoodWastageForHostel = async (
    json: any[], // Incoming JSON data
    hostelId: string,
    createdById: string,
    url: string
  ): Promise<string> => {
    try {
      const successArray: any[] = [];
      const errorArray: any[] = [];

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Check if the hostel exists
      const existingHostel = await Hostel.exists({ _id: hostelId });
      if (!existingHostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      // Convert Excel date format to JS Date format
      const jsonWithDates = json.map((item) => ({
        ...item,
        date: excelDateToJSDate(item?.Date),
      }));

      // Group the JSON data by date
      const groupedData = groupDataByDate(jsonWithDates);

      // Define the valid meal types
      type MealType = "breakfast" | "lunch" | "snacks" | "dinner";

      const bulkUpload = await BulkUpload.create({
        originalFile: url,
        fileType: BulkUploadTypes.FOOD_WASTAGE,
        createdBy: createdById,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      // Iterate over grouped data and create food wastage records
      for (const [date, menuItems] of Object.entries(groupedData)) {
        try {
          const normalizedDate = new Date(date);
          normalizedDate.setUTCHours(0, 0, 0, 0); // Normalize the date to UTC midnight

          // Initialize meal objects
          const mealData: Record<
            MealType,
            { amount: number; unit: UnitTypes }
          > = {
            breakfast: { amount: 0, unit: UnitTypes.KG },
            lunch: { amount: 0, unit: UnitTypes.KG },
            snacks: { amount: 0, unit: UnitTypes.KG },
            dinner: { amount: 0, unit: UnitTypes.KG },
          };

          // Populate meal data dynamically
          menuItems.forEach((item) => {
            const mealType = item["Meal Type"].toLowerCase() as MealType;
            if (mealType in mealData) {
              mealData[mealType] = {
                amount: item.Amount,
                unit: item.Unit as UnitTypes,
              };
            }
          });

          const { start, end } = this.formatDateRange(
            normalizedDate,
            normalizedDate
          );

          // Validate mess menu
          const mealIds = await this.validateMessMenu(start, end, hostelId, {
            breakfast: mealData.breakfast,
            lunch: mealData.lunch,
            snacks: mealData.snacks,
            dinner: mealData.dinner,
          });

          // Check for overlapping date range
          const dateExists = await FoodWastage.exists({
            hostelId,
            startDate: { $lte: end },
            endDate: { $gte: start },
          });
          if (dateExists) throw new Error(SAME_DATE);

          // Generate food wastage number
          const foodWastageNumber = await this.generateFoodWastageNumber();

          // Aggregate meal wastage
          const { totalAmount, unit } = aggregateMealAmounts([
            {
              breakfast: mealData.breakfast,
              lunch: mealData.lunch,
              snacks: mealData.snacks,
              dinner: mealData.dinner,
            },
          ]);

          // Create FoodWastage entry
          const foodWastage = new FoodWastage({
            foodWastageNumber,
            date: start,
            breakfast: mealData.breakfast,
            lunch: mealData.lunch,
            snacks: mealData.snacks,
            dinner: mealData.dinner,
            hostelId,
            totalWastage: totalAmount,
            totalUnit: unit,
            createdBy: createdById,
            mealIds,
            createdAt: getCurrentISTTime(),
            updatedAt: getCurrentISTTime(),
          });

          await foodWastage.save();
          successArray.push({ date });
        } catch (err: any) {
          errorArray.push({ date, error: err.message });
        }
      }

      // If there are successes or errors, generate CSV/Excel files and upload them to AWS S3
      let successFileUrl = null;
      let errorFileUrl = null;

      if (successArray.length > 0) {
        successFileUrl = await pushToS3Bucket(
          successArray,
          process.env.S3_BUCKET_NAME as string,
          FOOD_WASTAGE_BULK_UPLOAD_FILES
        );
      }

      if (errorArray.length > 0) {
        errorFileUrl = await pushToS3Bucket(
          errorArray,
          process.env.S3_BUCKET_NAME as string,
          FOOD_WASTAGE_BULK_UPLOAD_FILES
        );
      }

      // Update bulk upload record
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

  //ANCHOR - generate FoodWastage  Number
  generateFoodWastageNumber = async (): Promise<string> => {
    try {
      const lastFoodWastage: any = await FoodWastage.findOne({})
        .sort({ foodWastageNumber: -1 }) // Sort in descending order
        .select("foodWastageNumber");

      let foodWastageNumber = "FW-001";

      if (lastFoodWastage && lastFoodWastage.foodWastageNumber) {
        // Extract the numeric part of the foodWastageNumber
        const lastNumber = parseInt(
          lastFoodWastage.foodWastageNumber.replace("FW-", ""),
          10
        );

        // Increment the number and pad it to 3 digits
        const nextNumber = lastNumber + 1;
        foodWastageNumber = `FW-${String(nextNumber).padStart(3, "0")}`;
      }

      return foodWastageNumber;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  getDateWiseWastageCount = async (
    hostelId: string,
    date: Date | string
  ): Promise<any> => {
    try {
      const searchDate = dayjs.utc(date).startOf("day");
      const startRange = searchDate.subtract(6, "hours").toDate();
      const endRange = searchDate.add(18, "hours").toDate();

      const foodWastage = await FoodWastage.findOne({
        hostelId,
        date: { $gte: startRange, $lte: endRange },
      });

      if (!foodWastage) {
        return {
          breakfast: { amount: 0, unit: UnitTypes.G },
          lunch: { amount: 0, unit: UnitTypes.G },
          snacks: { amount: 0, unit: UnitTypes.G },
          dinner: { amount: 0, unit: UnitTypes.G },
          totalWastage: 0,
          totalUnit: UnitTypes.G,
        };
      }

      return {
        breakfast: foodWastage.breakfast || { amount: 0, unit: UnitTypes.G },
        lunch: foodWastage.lunch || { amount: 0, unit: UnitTypes.G },
        snacks: foodWastage.snacks || { amount: 0, unit: UnitTypes.G },
        dinner: foodWastage.dinner || { amount: 0, unit: UnitTypes.G },
        totalWastage: foodWastage.totalWastage,
        totalUnit: foodWastage.totalUnit,
        foodWastageNumber: foodWastage.foodWastageNumber,
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //ANCHOR - format Date Range
  private formatDateRange(
    startDate: Date,
    endDate: Date
  ): { start: Date; end: Date } {
    const formatStartDate = new Date(startDate);
    formatStartDate.setUTCHours(0, 0, 0, 0);

    const formatEndDate = new Date(endDate);
    formatEndDate.setUTCHours(23, 59, 59, 999);

    return { start: formatStartDate, end: formatEndDate };
  }

  //ANCHOR - validate Mess Menu
  private async validateMessMenu(
    startDate: Date,
    endDate: Date,
    hostelId: string,
    meals: {
      breakfast?: {
        amount: number;
        unit: UnitTypes;
      };
      lunch?: {
        amount: number;
        unit: UnitTypes;
      };
      snacks?: {
        amount: number;
        unit: UnitTypes;
      };
      dinner?: {
        amount: number;
        unit: UnitTypes;
      };
    }
  ): Promise<string[]> {
    // Get all dates between startDate and endDate
    const dates = getDatesBetween(new Date(startDate), new Date(endDate));

    // Find data in MessMenu for the given dates
    const checkMessMenu: any = await MessMenu.find({
      hostelId,
      date: { $in: dates },
    });

    if (checkMessMenu.length === 0) {
      throw new Error(NO_DATA_IN_GIVEN_DATE);
    }

    // Validate meal entries
    checkMessMenu.forEach((menu: any) => {
      const formattedDate = dayjs(menu.date).format("YYYY-MM-DD");
      if (meals.breakfast && menu.breakfast === null) {
        throw new Error(`Breakfast is missing for the date: ${formattedDate}`);
      }
      if (meals.lunch && menu.lunch === null) {
        throw new Error(`Lunch is missing for the date: ${formattedDate}`);
      }
      if (meals.snacks && menu.snacks === null) {
        throw new Error(`Snacks are missing for the date: ${formattedDate}`);
      }
      if (meals.dinner && menu.dinner === null) {
        throw new Error(`Dinner is missing for the date: ${formattedDate}`);
      }
    });

    return checkMessMenu.map((menu: any) => menu._id);
  }

  //ANCHOR - validate Mess Menu for single date (Create flow)
  private async validateMessMenuSingleDate(
    date: Date,
    hostelId: string,
    meals: {
      breakfast?: { amount: number; unit: UnitTypes };
      lunch?: { amount: number; unit: UnitTypes };
      snacks?: { amount: number; unit: UnitTypes };
      dinner?: { amount: number; unit: UnitTypes };
    }
  ): Promise<string[]> {
    // Shifted range searching window to align UTC with IST days
    const searchDate = dayjs.utc(date).startOf("day");
    const startRange = searchDate.subtract(6, "hours").toDate();
    const endRange = searchDate.add(18, "hours").toDate();

    const checkMessMenu: any = await MessMenu.findOne({
      hostelId,
      date: { $gte: startRange, $lte: endRange },
    });

    if (!checkMessMenu) {
      throw new Error(NO_DATA_IN_GIVEN_DATE);
    }

    const formattedDate = dayjs(checkMessMenu.date).format("YYYY-MM-DD");
    if (
      meals.breakfast &&
      (checkMessMenu.breakfast === null || checkMessMenu.breakfast === "-")
    ) {
      throw new Error(`Breakfast is missing for the date: ${formattedDate}`);
    }
    if (
      meals.lunch &&
      (checkMessMenu.lunch === null || checkMessMenu.lunch === "-")
    ) {
      throw new Error(`Lunch is missing for the date: ${formattedDate}`);
    }
    if (
      meals.snacks &&
      (checkMessMenu.snacks === null || checkMessMenu.snacks === "-")
    ) {
      throw new Error(`Snacks are missing for the date: ${formattedDate}`);
    }
    if (
      meals.dinner &&
      (checkMessMenu.dinner === null || checkMessMenu.dinner === "-")
    ) {
      throw new Error(`Dinner is missing for the date: ${formattedDate}`);
    }

    return [checkMessMenu._id];
  }

  //SECTION - Validate Meal End Time
  private async validateMealEndTime(
    hostelId: string,
    date: Date | string,
    meals: {
      breakfast?: any;
      lunch?: any;
      snacks?: any;
      dinner?: any;
    }
  ): Promise<void> {
    const timings = await HostelMealTiming.findOne({ hostelId, status: true }).lean();
    this.checkMealEndTimeInPlace(timings, date, meals);
  }

  // Internal method to perform check using pre-fetched timings
  private checkMealEndTimeInPlace(
    timings: any,
    date: Date | string,
    meals: {
      breakfast?: any;
      lunch?: any;
      snacks?: any;
      dinner?: any;
    }
  ): void {
    const inputDate = dayjs(date).tz("Asia/Kolkata").startOf("day");
    const today = dayjs().tz("Asia/Kolkata").startOf("day");

    // Only validate for "today"
    if (!inputDate.isSame(today)) {
      return;
    }

    const currentTime = dayjs().tz("Asia/Kolkata");

    const mealConfigs = [
      { key: "breakfast", label: "Breakfast", endTime: timings?.breakfastStartTime || "07:00", duration: 180 }, // Default 7am-10am
      { key: "lunch", label: "Lunch", endTime: timings?.lunchStartTime || "12:00", duration: 210 }, // Default 12pm-3:30pm
      { key: "snacks", label: "Snacks", endTime: timings?.snacksStartTime || "17:00", duration: 120 }, // Default 5pm-7pm
      { key: "dinner", label: "Dinner", endTime: timings?.dinnerStartTime || "19:30", duration: 150 }, // Default 7:30pm-10pm
    ];

    // Correction: Use EndTime fields if available in the model
    const mealEndConfigs = [
      { key: "breakfast", label: "Breakfast", endTime: timings?.breakfastEndTime || "10:00" },
      { key: "lunch", label: "Lunch", endTime: timings?.lunchEndTime || "15:30" },
      { key: "snacks", label: "Hi-Tea", endTime: timings?.snacksEndTime || "19:00" },
      { key: "dinner", label: "Dinner", endTime: timings?.dinnerEndTime || "22:00" },
    ];

    for (const config of mealEndConfigs) {
      if (meals[config.key as keyof typeof meals]) {
        const [hour, minute] = config.endTime.split(":").map(Number);
        const mealEndMoment = today.clone().set("hour", hour).set("minute", minute).set("second", 0).set("millisecond", 0);

        if (currentTime.isBefore(mealEndMoment)) {
          const displayTime = dayjs(mealEndMoment).format("hh:mm A");
          throw new Error(
            `${config.label} wastage can only be recorded after the meal service ends at ${displayTime}.`
          );
        }
      }
    }
  }
}

export default new FoodWastageService();
