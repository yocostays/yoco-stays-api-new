import moment from "moment";
import FoodWastage from "../models/foodWastage.model";
import Hostel from "../models/hostel.model";
import MessMenu from "../models/messMenu.model";
import BulkUpload from "../models/bulkUpload.model";
import { pushToS3Bucket } from "../utils/awsUploadService";
import { FOOD_WASTAGE_BULK_UPLOAD_FILES } from "../utils/s3bucketFolder";
import {
  VALIDATION_MESSAGES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import {
  BulkUploadTypes,
  MealCountReportType,
  SortingTypes,
  UnitTypes,
} from "../utils/enum";
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
  //SECTION: Method to create FoodWastage report
  createFoodWastage = async (
    startDate: Date,
    endDate: Date,
    breakfast: {
      amount: number;
      unit: UnitTypes;
    },
    lunch: {
      amount: number;
      unit: UnitTypes;
    },
    snacks: {
      amount: number;
      unit: UnitTypes;
    },
    dinner: {
      amount: number;
      unit: UnitTypes;
    },
    hostelId: string,
    createdById: string
  ): Promise<string> => {
    try {
      const { start, end } = this.formatDateRange(startDate, endDate);

      // Validate mess menu
      const mealIds = await this.validateMessMenu(start, end, hostelId, {
        breakfast,
        lunch,
        snacks,
        dinner,
      });

      // Check for overlapping date range
      const dateExists = await FoodWastage.exists({
        hostelId,
        startDate: { $lte: end },
        endDate: { $gte: start },
      });
      if (dateExists) throw new Error(SAME_DATE);

      // Ensure hostel exists
      if (!(await Hostel.exists({ _id: hostelId })))
        throw new Error(RECORD_NOT_FOUND("Hostel"));

      // Generate food wastage number
      const foodWastageNumber = await this.generateFoodWastageNumber();

      // Aggregate meal wastage
      const { totalAmount, unit } = aggregateMealAmounts([
        { breakfast, lunch, snacks, dinner },
      ]);

      // Create FoodWastage entry
      await FoodWastage.create({
        foodWastageNumber,
        startDate: start,
        endDate: end,
        breakfast,
        lunch,
        snacks,
        dinner,
        hostelId,
        totalWastage: totalAmount,
        totalUnit: unit,
        createdBy: createdById,
        mealIds,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get all FoodWastage report
  getAllFoodWastage = async (
    page: number,
    limit: number,
    mealType: MealCountReportType,
    sort?: SortingTypes,
    hostelId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ data: any[]; count: number }> => {
    try {
      const skip = (page - 1) * limit;
      const hostelIdParams = hostelId ? { hostelId } : {};

      // Sorting logic
      const sortOptions: any = { createdAt: -1 };
      let searchParams: any = {};

      if (sort === SortingTypes.OLDEST) sortOptions.createdAt = 1;
      if (sort === SortingTypes.CUSTOM && startDate && endDate) {
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);

        searchParams = { startDate: { $gte: start }, endDate: { $lte: end } };
      }

      // Meal type filter dynamically
      const mealFields: Record<string, any> = {
        [MealCountReportType.BREAKFAST]: "breakfast",
        [MealCountReportType.LUNCH]: "lunch",
        [MealCountReportType.DINNER]: "dinner",
        [MealCountReportType.HI_TEA]: "snacks",
      };

      const searchMealTypes =
        mealType !== MealCountReportType.ALL
          ? { [mealFields[mealType]]: { $ne: null } }
          : {};

      // Fetch data in parallel
      const [count, foodWastage] = await Promise.all([
        FoodWastage.countDocuments({
          ...searchMealTypes,
          ...hostelIdParams,
          ...searchParams,
        }),
        FoodWastage.find({
          ...searchMealTypes,
          ...hostelIdParams,
          ...searchParams,
        })
          .populate([
            { path: "createdBy", select: "name" },
            { path: "hostelId", select: "name" },
          ])
          .sort(sortOptions)
          .skip(skip)
          .limit(limit),
      ]);

      // Map response dynamically
      const response = foodWastage.map((ele: any) => {
        const baseData = {
          _id: ele._id,
          foodWastageNumber: ele.foodWastageNumber ?? null,
          startDate: ele?.startDate ?? null,
          endDate: ele?.endDate ?? null,
          hostelId: ele?.hostelId?._id ?? null,
          hostelName: ele?.hostelId?.name ?? null,
          totalWastage: ele?.totalWastage ?? null,
          totalUnit: ele?.totalUnit ?? null,
          feedback: 0,
          createdBy: ele?.createdBy?.name ?? null,
          createdAt: ele?.createdAt ?? null,
        };

        // Dynamically assign meal fields based on mealType
        return {
          ...baseData,
          ...Object.fromEntries(
            Object.entries(mealFields).map(([key, field]) => [
              field,
              mealType === MealCountReportType.ALL || mealType === key
                ? ele?.[field]
                  ? `${ele[field].amount ?? 0} ${ele[field].unit ?? ""}`
                  : null
                : null,
            ])
          ),
        };
      });

      return { data: response, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

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
    startDate: Date,
    endDate: Date,
    breakfast: {
      amount: number;
      unit: UnitTypes;
    },
    lunch: {
      amount: number;
      unit: UnitTypes;
    },
    snacks: {
      amount: number;
      unit: UnitTypes;
    },
    dinner: {
      amount: number;
      unit: UnitTypes;
    },
    hostelId: string,
    updatedById: string
  ): Promise<string> => {
    try {
      // Check if FoodWastage entry exists
      if (!(await FoodWastage.findById(id)))
        throw new Error(RECORD_NOT_FOUND("FoodWastage"));

      const { start, end } = this.formatDateRange(startDate, endDate);

      // Validate mess menu
      const mealIds = await this.validateMessMenu(start, end, hostelId, {
        breakfast,
        lunch,
        snacks,
        dinner,
      });

      // Check for overlapping date range
      const dateExists = await FoodWastage.exists({
        _id: { $ne: id },
        hostelId,
        startDate: { $lte: end },
        endDate: { $gte: start },
      });
      if (dateExists) throw new Error(SAME_DATE);

      // Ensure hostel exists
      if (!(await Hostel.exists({ _id: hostelId })))
        throw new Error(RECORD_NOT_FOUND("Hostel"));

      // Aggregate meal wastage
      const { totalAmount, unit } = aggregateMealAmounts([
        { breakfast, lunch, snacks, dinner },
      ]);

      // Update FoodWastage entry
      await FoodWastage.findByIdAndUpdate(id, {
        $set: {
          mealIds,
          startDate: start,
          endDate: end,
          breakfast,
          lunch,
          snacks,
          dinner,
          hostelId,
          totalWastage: totalAmount,
          totalUnit: unit,
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
            startDate: start,
            endDate: end,
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
      const formattedDate = moment(menu.date).format("YYYY-MM-DD");
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
}
export default new FoodWastageService();
