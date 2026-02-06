import cron from "node-cron";
import MessService from "./mess.service";
import BookMeals from "../models/bookMeal.model";
import HostelMealTiming from "../models/hostelMealTiming.model";
import HostelPolicy from "../models/hostelPolicy.model";
import Hostel from "../models/hostel.model";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { MealBookingIntent } from "../utils/enum";

dayjs.extend(utc);
dayjs.extend(timezone);

const MEALS = ["breakfast", "lunch", "snacks", "dinner"] as const;
type MealType = (typeof MEALS)[number];

const DEFAULT_BOOKING_CUTOFFS: Record<
  MealType,
  { dayOffset: number; time: string }
> = {
  breakfast: { dayOffset: -1, time: "21:00" },
  lunch: { dayOffset: 0, time: "08:00" },
  snacks: { dayOffset: 0, time: "13:00" },
  dinner: { dayOffset: 0, time: "16:00" },
};

const DEFAULT_CONSUMPTION_END: Record<MealType, string> = {
  breakfast: "10:00",
  lunch: "15:30",
  snacks: "19:00",
  dinner: "22:00",
};

class CronService {
  init() {
    console.log("[CronService] Initializing scheduled jobs...");

    // Schedule: Daily at 12:00 PM IST for auto-booking next day's meals
    cron.schedule(
      "0 16 * * *",
      async () => {
        try {
          await MessService.autoBookMealsForNextDay();
        } catch (error: any) {
          console.error("[CronService] Auto-Booking Failed:", error.message);
        }
      },
      { timezone: "Asia/Kolkata" },
    );

    // Schedule: Every hour to sync meal statuses (IST)
    cron.schedule(
      "0 * * * *",
      async () => {
        try {
          await this.syncMealStatuses();
        } catch (error: any) {
          console.error(
            "[CronService] Meal Status Sync Failed:",
            error.message,
          );
        }
      },
      { timezone: "Asia/Kolkata" },
    );

    console.log("[CronService] Production jobs scheduled (Asia/Kolkata).");
  }

  /**
   * Production-hardened Status Sync:
   * 1. Locks meals after booking cutoff.
   * 2. Marks CONFIRMED meals as consumed after meal end time.
   */
  private async syncMealStatuses(): Promise<void> {
    try {
      const nowIST = dayjs().tz("Asia/Kolkata");
      console.log(
        `[StatusSync] Starting sync at ${nowIST.format("YYYY-MM-DD HH:mm")} IST`,
      );

      const [allHostels, allPolicies, allTimings] = await Promise.all([
        Hostel.find({ status: true }).select("_id").lean(),
        HostelPolicy.find({ status: true }).lean(),
        HostelMealTiming.find({ status: true }).lean(),
      ]);

      const policiesMap = new Map(
        allPolicies.map((p) => [p.hostelId.toString(), p]),
      );
      const timingsMap = new Map(
        allTimings.map((t) => [t.hostelId.toString(), t]),
      );

      const datesToSync = [
        nowIST.subtract(1, "day").startOf("day"),
        nowIST.startOf("day"),
        nowIST.add(1, "day").startOf("day"),
      ];

      const bulkOps: any[] = [];

      for (const hostel of allHostels) {
        const hostelId = hostel._id.toString();
        const policy = policiesMap.get(hostelId);
        const timing = timingsMap.get(hostelId);

        for (const targetDate of datesToSync) {
          const dateUTC = dayjs.utc(targetDate.format("YYYY-MM-DD")).toDate();

          for (const meal of MEALS) {
            const cutoff = this.getBookingCutoff(targetDate, meal, policy);
            // const mealEnd = this.getMealEndTime(targetDate, meal, timing);

            const isLockPassed = nowIST.isAfter(cutoff);
            // const isConsumePassed = nowIST.isAfter(mealEnd);

            const updateSet: any = {};
            const filter: any = { hostelId: hostel._id, date: dateUTC };

            /** Commenting out consumption marking for now
            if (isConsumePassed) {
              // RULE: Only CONFIRMED meals are marked consumed
              // PENDING meals are just locked
              filter[`meals.${meal}.status`] = MealBookingIntent.CONFIRMED;
              filter[`meals.${meal}.consumed`] = { $ne: true }; // Idempotency

              updateSet[`meals.${meal}.consumed`] = true;
              updateSet[`meals.${meal}.consumedAt`] = mealEnd.toDate(); // Fixed semantics
              updateSet[`meals.${meal}.locked`] = true;
            } else
           */
            if (isLockPassed) {
              filter[`meals.${meal}.locked`] = { $ne: true }; // Idempotency
              filter[`meals.${meal}.status`] = {
                $in: [MealBookingIntent.CONFIRMED, MealBookingIntent.PENDING],
              };

              updateSet[`meals.${meal}.locked`] = true;
            }

            if (Object.keys(updateSet).length > 0) {
              bulkOps.push({
                updateMany: { filter, update: { $set: updateSet } },
              });
            }
          }
        }
      }

      const modifiedCount = await this.executeBulkInChunks(bulkOps);
      console.log(
        `[StatusSync] Success. Synchronized ${modifiedCount} records.`,
      );
    } catch (error: any) {
      console.error("[StatusSync] Fatal Error:", error.message);
      throw error;
    }
  }

  private getBookingCutoff(
    targetDate: Dayjs,
    meal: MealType,
    policy: any,
  ): Dayjs {
    let dOffset = DEFAULT_BOOKING_CUTOFFS[meal].dayOffset;
    let timeStr = DEFAULT_BOOKING_CUTOFFS[meal].time;

    if (policy?.bookingCutoffs?.[meal]) {
      dOffset = policy.bookingCutoffs[meal].dayOffset;
      timeStr = policy.bookingCutoffs[meal].time;
    }

    const [h, m] = timeStr.split(":").map(Number);
    return targetDate
      .clone()
      .add(dOffset, "day")
      .hour(h)
      .minute(m)
      .second(0)
      .millisecond(0);
  }

  private getMealEndTime(
    targetDate: Dayjs,
    meal: MealType,
    timing: any,
  ): Dayjs {
    let timeStr = DEFAULT_CONSUMPTION_END[meal];
    const field = `${meal}EndTime`;
    if (timing && timing[field]) {
      timeStr = timing[field];
    }

    const [h, m] = timeStr.split(":").map(Number);
    return targetDate.clone().hour(h).minute(m).second(0).millisecond(0);
  }

  private async executeBulkInChunks(
    ops: any[],
    chunkSize = 500,
  ): Promise<number> {
    let totalModified = 0;
    for (let i = 0; i < ops.length; i += chunkSize) {
      const chunk = ops.slice(i, i + chunkSize);
      const result = await BookMeals.bulkWrite(chunk);
      totalModified += result.modifiedCount || 0;
    }
    return totalModified;
  }
}

export default new CronService();
