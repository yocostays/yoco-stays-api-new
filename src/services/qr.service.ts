import crypto from "crypto";
import QRCode from "qrcode";
import mongoose from "mongoose";
import dayjs from "dayjs";
import QRSession from "../models/qrSession.model";
import BookMeals from "../models/bookMeal.model";
import HostelMealTiming from "../models/hostelMealTiming.model";
import { QRPurpose, MealBookingIntent } from "../utils/enum";
import { MealMapping } from "../utils/validators/qr.validator";
import {
  BadRequestError,
  ForbiddenError,
  ConflictError,
  UnauthorizedError,
  InternalServerError,
  NotFoundError,
  TooManyRequestsError,
} from "../utils/errors";
import { ERROR_MESSAGES } from "../utils/messages";
import { sendError } from "../utils/responseHelpers";

// Simple in-memory cache for timings: Map<hostelId, { timings: any, expiresAt: number }>
// TTL: 10 minutes
const TIMING_CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedTiming {
  timings: any;
  expiresAt: number;
}

class QRService {
  private timingsCache = new Map<string, CachedTiming>();

  // Helper: Convert HH:mm to minutes from midnight
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }
  // Generates a random token for QR
  private generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Generates QR code image as base64 data URL from token
  private async generateQRImage(token: string): Promise<string> {
    try {
      const qrDataURL = await QRCode.toDataURL(token, {
        errorCorrectionLevel: "M",
        type: "image/png",
        width: 512,
        margin: 2,
      });
      return qrDataURL;
    } catch (error) {
      throw new Error("Failed to generate QR code image");
    }
  }

  // Generates QR for a hostel by deactivating any existing one and creating a new one
  async generateQRForHostel(
    hostelId: string,
    purpose: QRPurpose,
    createdBy: string
  ): Promise<string> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const generationCount = await QRSession.countDocuments({
      hostelId: new mongoose.Types.ObjectId(hostelId),
      purpose,
      createdAt: { $gte: oneHourAgo },
    });

    if (generationCount >= 5) {
      throw new TooManyRequestsError(
        "Regeneration limit reached. Please wait before generating a new QR code."
      );
    }

    await QRSession.updateMany(
      {
        hostelId: new mongoose.Types.ObjectId(hostelId),
        purpose,
        isActive: true,
      },
      {
        $set: {
          isActive: false,
          rotatedAt: new Date(),
        },
      }
    );

    let token: string;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts < MAX_ATTEMPTS) {
      token = this.generateToken();
      attempts++;

      try {
        const qrSession = new QRSession({
          token,
          purpose,
          hostelId: new mongoose.Types.ObjectId(hostelId),
          isActive: true,
          createdBy: new mongoose.Types.ObjectId(createdBy),
        });

        await qrSession.save();
        const qrImage = await this.generateQRImage(token);
        return qrImage;
      } catch (error: any) {
        if (error.code === 11000 && attempts < MAX_ATTEMPTS) {
          continue;
        }
        throw error;
      }
    }

    throw new Error(
      "Failed to generate unique QR token after multiple attempts"
    );
  }

  // Fetches ALL currently active QR codes for a hostel
  async getActiveQR(hostelId: string): Promise<Record<string, string>> {
    const activeSessions = await QRSession.find({
      hostelId: new mongoose.Types.ObjectId(hostelId),
      isActive: true,
    }).select("token purpose");

    const qrMap: Record<string, string> = {};

    // Generate images for all active sessions found
    for (const session of activeSessions) {
      qrMap[session.purpose] = await this.generateQRImage(session.token);
    }

    return qrMap;
  }

  // Main entry point for processing a QR scan (PRODUCTION-READY)
  async processScan({
    token,
    studentId,
    studentHostelId,
  }: {
    token: string;
    studentId: string;
    studentHostelId: string;
  }): Promise<string> {
    // Validate QR token exists
    if (!token) throw new BadRequestError("QR token is required");

    // Resolve Current Time in IST
    const nowIST = dayjs().tz("Asia/Kolkata");
    const currentMinutes = this.timeToMinutes(nowIST.format("HH:mm"));
    const HARD_CUTOFF_MINUTES = 1410; // 23:30 = 23 * 60 + 30

    // Hard cutoff: No scans allowed after 23:30
    if (currentMinutes > HARD_CUTOFF_MINUTES) {
      throw new ConflictError(
        "Mess sessions are closed for today (Cutoff 11:30PM reached)"
      );
    }

    // Validate Token in DB (Optimized Projection)
    const qrSession = await QRSession.findOne({
      token,
      isActive: true,
    }).select("hostelId purpose isActive");

    if (!qrSession) {
      throw new BadRequestError("Invalid or inactive QR code");
    }

    // Validate Hostel Match (ObjectId .equals)
    if (
      !qrSession.hostelId.equals(new mongoose.Types.ObjectId(studentHostelId))
    ) {
      throw new ForbiddenError(
        "Access Denied: This QR code belongs to another hostel"
      );
    }

    // Route by Purpose
    switch (qrSession.purpose) {
      case QRPurpose.MESS_ATTENDANCE:
        return this.processMessAttendance(
          studentId,
          studentHostelId,
          nowIST,
          currentMinutes
        );
      default:
        throw new BadRequestError(
          `Automated scanning is not yet supported for purpose: ${qrSession.purpose}`
        );
    }
  }

  // Orchestrates Mess Attendance logic
  private async processMessAttendance(
    studentId: string,
    hostelId: string,
    nowIST: dayjs.Dayjs,
    currentMinutes: number
  ): Promise<string> {
    // Resolve Active Meal using START-TIME RANGES
    const activeMeal = await this.resolveActiveMealByRange(
      hostelId,
      currentMinutes
    );
    const bookMealField = MealMapping[activeMeal.toLowerCase()];

    if (!bookMealField) {
      throw new InternalServerError(
        "Internal Configuration Error: Meal mapping failed"
      );
    }

    // Leave Check
    // const onLeave = await this.isStudentOnLeave(studentId, nowIST);
    // if (onLeave) {
    //   throw new ForbiddenError("Attendance Rejected: You have an approved leave for today.");
    // }

    // Atomic & Idempotent Update
    const todayUTCDate = dayjs.utc(nowIST.format("YYYY-MM-DD")).toDate();

    const updateResponse = await BookMeals.findOneAndUpdate(
      {
        studentId: new mongoose.Types.ObjectId(studentId),
        hostelId: new mongoose.Types.ObjectId(hostelId),
        date: todayUTCDate,
        [`meals.${bookMealField}.status`]: { $ne: MealBookingIntent.PENDING }, // Allow CONFIRMED, SKIPPED, etc.
        [`meals.${bookMealField}.consumed`]: false,
      },
      {
        $set: {
          [`meals.${bookMealField}.consumed`]: true,
          [`meals.${bookMealField}.locked`]: true,
          [`meals.${bookMealField}.consumedAt`]: nowIST.toDate(),
        },
      },
      { new: true }
    );

    if (!updateResponse) {
      // Logic check to provide generic but helpful non-leaking error
      const booking = await BookMeals.findOne({
        studentId: new mongoose.Types.ObjectId(studentId),
        hostelId: new mongoose.Types.ObjectId(hostelId),
        date: todayUTCDate,
      })
        .select(`meals.${bookMealField}`)
        .lean();

      if (!booking) {
        throw new NotFoundError(
          `No booking record found for ${activeMeal} today`
        );
      }

      const mealState = (booking.meals as any)[bookMealField];

      // Check if meal field exists in booking (defensive check for partial records)
      if (!mealState) {
        throw new BadRequestError(
          `${activeMeal} is not available in your booking. Please book this meal first.`
        );
      }

      // If status is PENDING, explicitly reject
      if (mealState?.status === MealBookingIntent.PENDING) {
        throw new ForbiddenError(
          `Attendance Rejected: Your ${activeMeal} booking is PENDING.`
        );
      }

      if (mealState?.consumed) {
        throw new ConflictError(
          `Attendance Rejected: Your ${activeMeal} has already been marked as consumed.`
        );
      }

      throw new ConflictError(
        `Attendance Rejected: Something went wrong while verifying your ${activeMeal}. Please contact the mess warden.`
      );
    }

    return `Your ${activeMeal} marked as consumed successfully`;
  }

  // Deterministic Meal Resolution (Boundary Logic)
  // Rule: Last meal whose startTime ≤ currentISTTime
  private async resolveActiveMealByRange(
    hostelId: string,
    currentMinutes: number
  ): Promise<string> {
    // Cached Timings Lookup
    const now = Date.now();
    let timings = null;

    if (this.timingsCache.has(hostelId)) {
      const cached = this.timingsCache.get(hostelId)!;
      if (cached.expiresAt > now) {
        timings = cached.timings;
      }
    }

    if (!timings) {
      // Fetch from DB (Cache Miss/Expired)
      timings = await HostelMealTiming.findOne({
        hostelId,
        status: true,
      }).lean();

      // Let's cache the result (even if null/defaults logic applies later) to respect "Do not hit DB on every scan"
      this.timingsCache.set(hostelId, {
        timings,
        expiresAt: now + TIMING_CACHE_TTL_MS,
      });
    }

    const slots = [
      {
        name: "Breakfast",
        startMin: this.timeToMinutes(timings?.breakfastStartTime || "07:00"),
      },
      {
        name: "Lunch",
        startMin: this.timeToMinutes(timings?.lunchStartTime || "12:00"),
      },
      {
        name: "Snacks",
        startMin: this.timeToMinutes(timings?.snacksStartTime || "17:00"),
      },
      {
        name: "Dinner",
        startMin: this.timeToMinutes(timings?.dinnerStartTime || "19:30"),
      },
    ].sort((a, b) => a.startMin - b.startMin);

    // Resolve: Find the last slot whose startMin ≤ currentMinutes
    let activeMealName = "";
    for (const slot of slots) {
      if (slot.startMin <= currentMinutes) {
        activeMealName = slot.name;
      } else {
        break;
      }
    }

    if (!activeMealName || currentMinutes < slots[0].startMin) {
      throw new BadRequestError(
        `No active meal window found. Mess sessions start at ${Math.floor(
          slots[0].startMin / 60
        )}:${(slots[0].startMin % 60).toString().padStart(2, "0")}.`
      );
    }

    return activeMealName;
  }

  // Checks for approved leave on the server-calculated date
  // private async isStudentOnLeave(studentId: string, nowIST: dayjs.Dayjs): Promise<boolean> {
  //   const checkDate = dayjs.utc(nowIST.format("YYYY-MM-DD")).toDate();

  //   const leave = await StudentLeave.findOne({
  //     userId: new mongoose.Types.ObjectId(studentId),
  //     leaveStatus: LeaveStatusTypes.APPROVED,
  //     startDate: { $lte: checkDate },
  //     endDate: { $gte: checkDate },
  //   });
  //   return !!leave;
  // }
}

export default new QRService();
