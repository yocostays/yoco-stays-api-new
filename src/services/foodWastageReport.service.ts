import moment from "moment";
import FoodWastage from "../models/foodWastage.model";
import Hostel from "../models/hostel.model";
import { ERROR_MESSAGES } from "../utils/messages";
import {
  ExportTypes,
  MealCountReportType,
  ReportDropDownTypes,
  UnitTypes,
} from "../utils/enum";
import {
  aggregateMealAmounts,
  getDateRange,
  initialMealWasteLog,
} from "../utils/lib";

const { RECORD_NOT_FOUND, INVALID_DATE_RANGE } = ERROR_MESSAGES;

class FoodWastageReportService {
  //SECTION: Method to get FoodWastage report
  async foodWastageReport(
    hostelId: string,
    durationType: ReportDropDownTypes
  ): Promise<{ data: any[]; total: { totalAmount: number; unit: UnitTypes } }> {
    try {
      // Validate the hostel ID
      const hostelCheck = await Hostel.findById(hostelId);
      if (!hostelCheck) throw new Error(RECORD_NOT_FOUND("Hostel"));

      // Get the date range based on the provided durationType
      const { start, end } = durationType
        ? getDateRange(durationType as ReportDropDownTypes) || {
            start: null,
            end: null,
          }
        : { start: null, end: null };

      if (!start || !end) throw new Error(INVALID_DATE_RANGE);

      // Define date boundaries
      const startDate = new Date(start);
      startDate.setUTCHours(0, 0, 0, 0);

      const endDate = new Date(end);
      endDate.setUTCHours(23, 59, 59, 999);

      // Fetch FoodWastage records that overlap with the specified date range
      const foodWastages = await FoodWastage.find({
        hostelId,
        $or: [
          {
            startDate: { $lte: endDate },
            endDate: { $gte: startDate },
          },
        ],
      });

      const { totalAmount, unit } = aggregateMealAmounts(foodWastages);

      const data = [
        {
          meal: MealCountReportType.BREAKFAST,
          totalAmount: initialMealWasteLog.breakfast?.amount,
          unit: initialMealWasteLog.breakfast?.unit,
        },
        {
          meal: MealCountReportType.LUNCH,
          totalAmount: initialMealWasteLog.lunch?.amount,
          unit: initialMealWasteLog.lunch?.unit,
        },
        {
          meal: MealCountReportType.HI_TEA,
          totalAmount: initialMealWasteLog.snacks?.amount,
          unit: initialMealWasteLog.snacks?.unit,
        },
        {
          meal: MealCountReportType.DINNER,
          totalAmount: initialMealWasteLog.dinner?.amount,
          unit: initialMealWasteLog.dinner?.unit,
        },
      ];

      const total = { totalAmount, unit };

      return { data, total };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get FoodWastage details excel
  exportFoodWastageDetails = async (
    hostelId: string,
    type: ExportTypes,
    messMenuIds?: string[]
  ): Promise<{ result: any }> => {
    try {
      // Build query based on the type
      const query: any =
        type === ExportTypes.ALL ? { hostelId } : { _id: { $in: messMenuIds } };

      // Execute the query and select the necessary fields
      const foodWastage = await FoodWastage.find(query)
        .populate([
          { path: "hostelId", select: "name" },
          { path: "createdBy", select: "name" },
          { path: "updatedBy", select: "name" },
        ])
        .lean();

      if (!foodWastage || foodWastage.length === 0) {
        throw new Error(
          RECORD_NOT_FOUND(
            type === ExportTypes.ALL ? "Food Wastages" : "Food Wastage"
          )
        );
      }

      const result = foodWastage.map((meal: any) => ({
        hostel: meal?.hostelId?.name,
        date: moment(meal?.date).format("DD-MM-YYYY"),
        breakfast: meal?.breakfast
          ? `${meal.breakfast.amount ?? 0} ${meal.breakfast.unit ?? ""}`
          : null,
        lunch: meal?.lunch
          ? `${meal.lunch.amount ?? 0} ${meal.lunch.unit ?? ""}`
          : null,
        snacks: meal?.snacks
          ? `${meal.snacks.amount ?? 0} ${meal.snacks.unit ?? ""}`
          : null,
        dinner: meal?.dinner
          ? `${meal.dinner.amount ?? 0} ${meal.dinner.unit ?? ""}`
          : null,
        totalWastage: meal?.totalWastage ?? null,
        totalUnit: meal?.totalUnit ?? null,
        createdBy: meal?.createdBy?.name,
        updatedBy: meal?.updatedBy?.name,
      }));

      return { result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };
}

export default new FoodWastageReportService();
