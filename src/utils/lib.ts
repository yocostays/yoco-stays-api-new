import { VALIDATION_MESSAGES } from "../utils/messages";
import {
  BillingCycleTypes,
  PaymentStatusTypes,
  ReportDropDownTypes,
  UnitTypes,
} from "./enum";
import { addMonths } from "date-fns";

const { INVALID_BILLING_CYCLE } = VALIDATION_MESSAGES;
//ANCHOR - get Current IST Time
export function getCurrentISTTime(): Date {
  // Get the current UTC time
  const utcDate = new Date();

  // Calculate IST time (UTC + 5 hours 30 minutes)
  const istOffset = 5.5 * 60;
  const istTime = new Date(utcDate.getTime() + istOffset * 60 * 1000);

  return istTime;
}

//ANCHOR - generate Expiry Time
export const generateExpiryTime = (durationInHours: number): Date => {
  return new Date(Date.now() + durationInHours * 60 * 60 * 1000);
};

interface BillingCycleDetail {
  billingDate: Date;
  amount: number;
  paymentStatus: string;
}

//ANCHOR - create Billing Cycle Details
export const createBillingCycleDetails = (
  accommodationFee: number,
  billigCycle: BillingCycleTypes
): BillingCycleDetail[] => {
  const billingCycleDetails: BillingCycleDetail[] = [];
  const currentDate = new Date();
  currentDate.setUTCHours(0, 0, 0, 0); // Set the time to 00:00:00

  switch (billigCycle) {
    case BillingCycleTypes.ANNUAL:
      billingCycleDetails.push({
        billingDate: new Date(currentDate), // Create a new Date instance
        amount: accommodationFee * 12,
        paymentStatus: PaymentStatusTypes.PENDING,
      });
      break;

    case BillingCycleTypes.SEMI_ANNUAL:
      billingCycleDetails.push({
        billingDate: new Date(currentDate), // Create a new Date instance
        amount: accommodationFee * 6,
        paymentStatus: PaymentStatusTypes.PENDING,
      });
      billingCycleDetails.push({
        billingDate: addMonths(new Date(currentDate), 6), // Create a new Date instance
        amount: accommodationFee * 6,
        paymentStatus: PaymentStatusTypes.PENDING,
      });
      break;

    case BillingCycleTypes.QUARTERLY:
      for (let i = 0; i < 4; i++) {
        billingCycleDetails.push({
          billingDate: addMonths(new Date(currentDate), i * 3), // Create a new Date instance
          amount: accommodationFee * 3,
          paymentStatus: PaymentStatusTypes.PENDING,
        });
      }
      break;

    case BillingCycleTypes.MONTHLY:
      for (let i = 0; i < 12; i++) {
        billingCycleDetails.push({
          billingDate: addMonths(new Date(currentDate), i), // Create a new Date instance
          amount: accommodationFee,
          paymentStatus: PaymentStatusTypes.PENDING,
        });
      }
      break;

    default:
      throw new Error(INVALID_BILLING_CYCLE);
  }

  return billingCycleDetails;
};

//ANCHOR: Function to get all dates between two dates
export const getDatesBetween = (startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);

  // Normalize the endDate to the end of the day
  endDate.setUTCHours(23, 59, 59, 999);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

//ANCHOR Function to get the day of the week for a given date
export const getDayOfWeek = (date: Date): string => {
  return date.toLocaleDateString("en-US", { weekday: "long" });
};

//ANCHOR: Utility function to convert Excel date to JS Date
export const excelDateToJSDate = (excelDate: number): string => {
  const excelBaseDate = new Date(Date.UTC(1899, 11, 30)); // December 30, 1899, UTC
  const jsDate = new Date(
    excelBaseDate.getTime() + excelDate * 24 * 60 * 60 * 1000
  );

  // Extract day, month, and year to format as MM/DD/YYYY
  const day = String(jsDate.getUTCDate()).padStart(2, "0");
  const month = String(jsDate.getUTCMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const year = jsDate.getUTCFullYear();

  return `${month}/${day}/${year}`;
};

//ANCHOR Utility function to group the JSON data based on date
export const groupDataByDate = (json: any[]): Record<string, any[]> => {
  return json.reduce((acc, item) => {
    let date: Date | null = null;

    if (typeof item.date === "string") {
      // Explicitly parse MM/DD/YYYY format
      const dateParts = item.date.split("/");
      if (dateParts.length === 3) {
        const [month, day, year] = dateParts.map(Number);
        date = new Date(Date.UTC(year, month - 1, day));
      } else {
        date = new Date(item.date);
      }
    } else {
      date = item.date;
    }

    // Ensure the date is valid
    if (date instanceof Date && !isNaN(date.getTime())) {
      const dateKey = date.toISOString().split("T")[0];

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }

      acc[dateKey].push(item);
    } else {
      console.warn(`Invalid date found: ${item.date}`);
    }

    return acc;
  }, {} as Record<string, any[]>);
};

//ANCHOR -Utility function to get the meal details for each date
export const getMealDetails = (
  menuItems: any[]
): { breakfast: string; lunch: string; snacks: string; dinner: string } => {
  let breakfast = "";
  let lunch = "";
  let snacks = "";
  let dinner = "";

  menuItems.forEach((item) => {
    const category = (item?.categories || "").trim().toLowerCase();
    const itemStr = (item?.Item || "").trim();

    if (!category || !itemStr) return;

    if (category === "breakfast") {
      breakfast += itemStr + ", ";
    } else if (category === "lunch") {
      lunch += itemStr + ", ";
    } else if (category === "snacks") {
      snacks += itemStr + ", ";
    } else if (category === "dinner") {
      dinner += itemStr + ", ";
    }
  });

  breakfast = breakfast.trim().replace(/,\s*$/, "");
  lunch = lunch.trim().replace(/,\s*$/, "");
  snacks = snacks.trim().replace(/,\s*$/, "");
  dinner = dinner.trim().replace(/,\s*$/, "");

  return { breakfast, lunch, snacks, dinner };
};
//ANCHOR -Utility function to get Date Range
export const getDateRange = (status: ReportDropDownTypes) => {
  const now = getCurrentISTTime();

  // Ensure the current time is at the start of the current day in IST
  const utcNow = new Date(now);
  utcNow.setUTCHours(0, 0, 0, 0);

  switch (status) {
    case ReportDropDownTypes.TODAY:
      return {
        start: utcNow.toISOString(),
        end: new Date(utcNow.setUTCHours(23, 59, 59, 999)).toISOString(),
      };

    case ReportDropDownTypes.TOMORROW:
      const tomorrowStart = new Date(utcNow);
      tomorrowStart.setUTCDate(utcNow.getUTCDate() + 1);

      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setUTCHours(23, 59, 59, 999);

      return {
        start: tomorrowStart.toISOString(),
        end: tomorrowEnd.toISOString(),
      };

    case ReportDropDownTypes.YESTERDAY:
      const yesterdayStart = new Date(utcNow);
      yesterdayStart.setUTCDate(utcNow.getUTCDate() - 1);

      const yesterdayEnd = new Date(yesterdayStart);
      yesterdayEnd.setUTCHours(23, 59, 59, 999);

      return {
        start: yesterdayStart.toISOString(),
        end: yesterdayEnd.toISOString(),
      };

    case ReportDropDownTypes.CURRENT_WEEK:
      const currentWeekStart = new Date(
        Date.UTC(
          utcNow.getUTCFullYear(),
          utcNow.getUTCMonth(),
          utcNow.getUTCDate() - utcNow.getUTCDay() // Get the first day of the week (Sunday)
        )
      );
      const currentWeekEnd = new Date(
        Date.UTC(
          currentWeekStart.getUTCFullYear(),
          currentWeekStart.getUTCMonth(),
          currentWeekStart.getUTCDate() + 6, // End of the current week (Saturday)
          23,
          59,
          59,
          999
        )
      );
      return {
        start: currentWeekStart.toISOString(),
        end: currentWeekEnd.toISOString(),
      };

    case ReportDropDownTypes.LAST_WEEK:
      const lastWeekStart = new Date(
        Date.UTC(
          utcNow.getUTCFullYear(),
          utcNow.getUTCMonth(),
          utcNow.getUTCDate() - utcNow.getUTCDay() - 7 // Go to the start of last week
        )
      );
      const lastWeekEnd = new Date(
        Date.UTC(
          lastWeekStart.getUTCFullYear(),
          lastWeekStart.getUTCMonth(),
          lastWeekStart.getUTCDate() + 6, // End of last week
          23,
          59,
          59,
          999
        )
      );
      return {
        start: lastWeekStart.toISOString(),
        end: lastWeekEnd.toISOString(),
      };

    case ReportDropDownTypes.PAST_TWO_WEEK:
      const twoWeeksAgoStart = new Date(
        Date.UTC(
          utcNow.getUTCFullYear(),
          utcNow.getUTCMonth(),
          utcNow.getUTCDate() - utcNow.getUTCDay() - 14 // Go to the start of two weeks ago
        )
      );
      const twoWeeksAgoEnd = new Date(
        Date.UTC(
          twoWeeksAgoStart.getUTCFullYear(),
          twoWeeksAgoStart.getUTCMonth(),
          twoWeeksAgoStart.getUTCDate() + 13, // End of the two-week period
          23,
          59,
          59,
          999
        )
      );
      return {
        start: twoWeeksAgoStart.toISOString(),
        end: twoWeeksAgoEnd.toISOString(),
      };

    case ReportDropDownTypes.CURRENT_MONTH:
      const currentMonthStart = new Date(
        Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), 1) // Start of current month
      );
      const currentMonthEnd = new Date(
        Date.UTC(
          utcNow.getUTCFullYear(),
          utcNow.getUTCMonth() + 1, // Move to the start of next month
          0, // Get last day of current month
          23,
          59,
          59,
          999
        )
      );
      return {
        start: currentMonthStart.toISOString(),
        end: currentMonthEnd.toISOString(),
      };

    case ReportDropDownTypes.LAST_MONTH:
      const lastMonthStart = new Date(
        Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth() - 1, 1) // Start of last month
      );
      const lastMonthEnd = new Date(
        Date.UTC(
          lastMonthStart.getUTCFullYear(),
          lastMonthStart.getUTCMonth() + 1, // Move to start of current month
          0, // Get last day of last month
          23,
          59,
          59,
          999
        )
      );
      return {
        start: lastMonthStart.toISOString(),
        end: lastMonthEnd.toISOString(),
      };

    case ReportDropDownTypes.CURRENT_YEAR:
      const currentYearStart = new Date(
        Date.UTC(utcNow.getUTCFullYear(), 0, 1) // Start of current year (January 1st)
      );
      const currentYearEnd = new Date(
        Date.UTC(utcNow.getUTCFullYear(), 11, 31, 23, 59, 59, 999) // End of current year (December 31st)
      );
      return {
        start: currentYearStart.toISOString(),
        end: currentYearEnd.toISOString(),
      };

    case ReportDropDownTypes.LAST_YEAR:
      const lastYearStart = new Date(
        Date.UTC(utcNow.getUTCFullYear() - 1, 0, 1) // Start of last year
      );
      const lastYearEnd = new Date(
        Date.UTC(lastYearStart.getUTCFullYear(), 11, 31, 23, 59, 59, 999) // End of last year
      );
      return {
        start: lastYearStart.toISOString(),
        end: lastYearEnd.toISOString(),
      };

    default:
      throw new Error("Invalid status");
  }
};

// Utility to get the first and last dates of the month
export const getMonthDateRange = (
  date: string
): { startOfMonth: Date; endOfMonth: Date } => {
  const inputDate = new Date(date);
  const startOfMonth = new Date(
    inputDate.getFullYear(),
    inputDate.getMonth(),
    1
  );
  const endOfMonth = new Date(
    inputDate.getFullYear(),
    inputDate.getMonth() + 1,
    0
  );
  return { startOfMonth, endOfMonth };
};

// Utility to initialize the initial Meal Waste Log
export const initialMealWasteLog = {
  breakfast: { amount: 0, unit: UnitTypes.KG },
  lunch: { amount: 0, unit: UnitTypes.KG },
  snacks: { amount: 0, unit: UnitTypes.KG },
  dinner: { amount: 0, unit: UnitTypes.KG },
};

// Utility to do unit conversions
export const UNIT_CONVERSIONS: Record<string, number> = {
  [UnitTypes.KG]: 1000,
  [UnitTypes.G]: 1,
  [UnitTypes.L]: 1000,
  [UnitTypes.ML]: 1,
};

// Utility function to convert the unit
export const convertToKg = (amount: number, unit: UnitTypes): number => {
  return (amount * UNIT_CONVERSIONS[unit]) / UNIT_CONVERSIONS[UnitTypes.KG];
};

// Utility function to aggregate Meal Amounts
export const aggregateMealAmounts = (
  foodWastages: any[]
): { totalAmount: number; unit: UnitTypes } => {
  let overallTotalInKg = 0;

  // Aggregate amounts for each meal type
  foodWastages.forEach((wastage) => {
    // Handle breakfast
    if (wastage.breakfast?.amount) {
      const convertedAmount = convertToKg(
        wastage.breakfast.amount,
        wastage.breakfast.unit
      );
      initialMealWasteLog.breakfast.amount += convertedAmount;
      overallTotalInKg += convertedAmount;
      // Set unit for breakfast based on the conversion
      initialMealWasteLog.breakfast.unit = wastage.breakfast.unit;
    }

    // Handle lunch
    if (wastage.lunch?.amount) {
      const convertedAmount = convertToKg(
        wastage.lunch.amount,
        wastage.lunch.unit
      );
      initialMealWasteLog.lunch.amount += convertedAmount;
      overallTotalInKg += convertedAmount;
      // Set unit for lunch based on the conversion
      initialMealWasteLog.lunch.unit = wastage.lunch.unit;
    }

    // Handle snacks
    if (wastage.snacks?.amount) {
      const convertedAmount = convertToKg(
        wastage.snacks.amount,
        wastage.snacks.unit
      );
      initialMealWasteLog.snacks.amount += convertedAmount;
      overallTotalInKg += convertedAmount;
      // Set unit for snacks based on the conversion
      initialMealWasteLog.snacks.unit = wastage.snacks.unit;
    }

    // Handle dinner
    if (wastage.dinner?.amount) {
      const convertedAmount = convertToKg(
        wastage.dinner.amount,
        wastage.dinner.unit
      );
      initialMealWasteLog.dinner.amount += convertedAmount;
      overallTotalInKg += convertedAmount;
      // Set unit for dinner based on the conversion
      initialMealWasteLog.dinner.unit = wastage.dinner.unit;
    }
  });

  // Calculate total amount and decide the unit
  let totalAmount: number;
  let unit: UnitTypes;

  // If the total amount in KG is 1 or more, use KG, else use grams (G)
  if (overallTotalInKg >= 1) {
    totalAmount = overallTotalInKg; // Keep in KG
    unit = UnitTypes.KG;
  } else {
    totalAmount = overallTotalInKg * UNIT_CONVERSIONS[UnitTypes.KG]; // Convert to grams if less than 1 kg
    unit = UnitTypes.G;
  }

  // Return the total amount in the correct unit (kg or g)
  return { totalAmount, unit };
};

export const populateTemplate = (
  template: string,
  data: Record<string, any>
): string => {
  return template.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] ?? "");
};

export const formatDateOnly = (dateValue: Date | string): string => {
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return date.toISOString().split("T")[0];
};

//NOTE: Remove html tags from given data.
export const removeHtmlTags = (str: string): string => {
  if (!str || typeof str !== "string") {
    return "";
  }
  return str?.replace(/<\/?[^>]+(>|$)/g, "");
};
