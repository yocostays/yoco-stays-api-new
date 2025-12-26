import cron from "node-cron";
import MessService from "./mess.service";
import BookMeals from "../models/bookMeal.model";
import HostelMealTiming from "../models/hostelMealTiming.model";
import Hostel from "../models/hostel.model";
import moment from "moment-timezone";
import { MealBookingIntent } from "../utils/enum";

class CronService {
  init() {
    console.log("[CronService] Initializing scheduled jobs...");

    // Schedule: Daily at 12:00 PM IST for auto-booking next day's meals
    cron.schedule(
      "0 12 * * *",
      async () => {
        console.log(
          "[CronService] Triggering Daily Auto-Booking (Asia/Kolkata)..."
        );
        try {
          await MessService.autoBookMealsForNextDay();
        } catch (error: any) {
          console.error("[CronService] Auto-Booking Failed:", error.message);
        }
      },
      {
        timezone: "Asia/Kolkata",
      }
    );

    console.log("[CronService] Daily Auto-Booking scheduled for 12:00 PM IST.");

    // Schedule: Every hour to mark meals as consumed after their end time
    cron.schedule(
      "0 * * * *",
      async () => {
        console.log(
          "[CronService] Triggering Meal Consumption Update (Asia/Kolkata)..."
        );
        try {
          await this.markMealsAsConsumed();
        } catch (error: any) {
          console.error(
            "[CronService] Meal Consumption Update Failed:",
            error.message
          );
        }
      },
      {
        timezone: "Asia/Kolkata",
      }
    );

    console.log(
      "[CronService] Meal Consumption Update scheduled for every hour (IST)."
    );
  }

  /**
   * Marks meals as consumed based on hybrid time cutoffs
   * Runs every hour to update consumption status
   * 
   * Priority:
   * 1. Uses hostel-specific meal timings from HostelMealTiming (if configured)
   * 2. Falls back to hardcoded defaults if not configured:
   *    - Breakfast: 10:00 AM
   *    - Lunch: 3:30 PM
   *    - Hi-Tea: 7:00 PM
   *    - Dinner: 10:00 PM
   */
  private async markMealsAsConsumed(): Promise<void> {
    try {
      const nowIST = moment().tz("Asia/Kolkata");
      const todayUTC = moment.utc(nowIST.format("YYYY-MM-DD")).toDate();

      console.log(
        `[ConsumptionUpdate] Processing meals for ${nowIST.format(
          "YYYY-MM-DD HH:mm"
        )} IST`
      );

      // Default fallback times (hour, minute)
      const defaultCutoffs = {
        breakfast: { hour: 10, minute: 0 },
        lunch: { hour: 15, minute: 30 },
        snacks: { hour: 19, minute: 0 }, // Hi-Tea
        dinner: { hour: 22, minute: 0 },
      };

      // Fetch all hostels with configured meal timings
      const hostelTimings = await HostelMealTiming.find({
        status: true,
      }).lean();

      // Group by hostelId for easy lookup
      const timingsByHostel = new Map(
        hostelTimings.map((t) => [t.hostelId.toString(), t])
      );

      // Fetch all hostels to process both configured and unconfigured
      const allHostels = await Hostel.find({ status: true })
        .select("_id")
        .lean();

      let totalUpdated = 0;

      for (const hostel of allHostels) {
        const hostelId = hostel._id.toString();
        const timing = timingsByHostel.get(hostelId);

        const bulkOps: any[] = [];

        for (const mealName of [
          "breakfast",
          "lunch",
          "snacks",
          "dinner",
        ] as const) {
          // Determine cutoff time: DB timing first, then fall back to default
          let cutoffTime: { hour: number; minute: number };

          if (timing) {
            const endTimeField = `${mealName}EndTime` as keyof typeof timing;
            const dbEndTime = timing[endTimeField] as string | undefined;

            if (dbEndTime) {
              // Use database timing
              const [hour, minute] = dbEndTime.split(":").map(Number);
              cutoffTime = { hour, minute };
            } else {
              // DB exists but this meal not configured, use default
              cutoffTime = defaultCutoffs[mealName];
            }
          } else {
            // No timing configured for this hostel, use default
            cutoffTime = defaultCutoffs[mealName];
          }

          // Check if current time has passed the cutoff
          const hasPassed =
            nowIST.hour() > cutoffTime.hour ||
            (nowIST.hour() === cutoffTime.hour &&
              nowIST.minute() >= cutoffTime.minute);

          if (!hasPassed) {
            continue; // Skip meals whose cutoff hasn't passed yet
          }

          // Mark as consumed for this hostel, meal, and date
          bulkOps.push({
            updateMany: {
              filter: {
                hostelId: hostel._id,
                date: todayUTC,
                [`meals.${mealName}.bookingIntent`]:
                  MealBookingIntent.CONFIRMED,
                $or: [
                  { [`meals.${mealName}.consumed`]: false },
                  { [`meals.${mealName}.consumed`]: { $exists: false } },
                ],
              },
              update: {
                $set: {
                  [`meals.${mealName}.consumed`]: true,
                  [`meals.${mealName}.consumedAt`]: nowIST.toDate(),
                },
              },
            },
          });
        }

        if (bulkOps.length > 0) {
          const result = await BookMeals.bulkWrite(bulkOps);
          const updated = result.modifiedCount || 0;
          totalUpdated += updated;

          if (updated > 0) {
            const source = timing ? "DB timing" : "default timing";
            console.log(
              `[ConsumptionUpdate] Hostel ${hostelId} (${source}): Marked ${updated} meals as consumed`
            );
          }
        }
      }

      console.log(
        `[ConsumptionUpdate] Total meals marked as consumed: ${totalUpdated}`
      );
    } catch (error: any) {
      console.error(
        "[ConsumptionUpdate] Error marking meals as consumed:",
        error.message
      );
      throw error;
    }
  }
}

export default new CronService();
