import mongoose from "mongoose";
import moment from "moment";
import User from "../models/user.model";
import Hostel from "../models/hostel.model";
import StudentLeave from "../models/student-leave.model";
import { ERROR_MESSAGES } from "../utils/messages";
import StudentHostelAllocation from "../models/studentHostelAllocation.model";
import {
  ExportTypes,
  LeaveStatusTypes,
  LeaveTypes,
  ReportDropDownTypes,
} from "../utils/enum";
const { RECORD_NOT_FOUND } = ERROR_MESSAGES;
import { getDateRange } from "../utils/lib";

class LeaveReportService {
  //SECTION: Method to get user count report and top complaint categories
  leaveReportSummary = async (
    hostelId: string,
    durationType?: ReportDropDownTypes,
    startDate?: string,
    endDate?: string
  ): Promise<{ report: any }> => {
    try {
      // If hostelId is provided, include it in the query
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

      // Determine the date range based on durationType
      let start: Date, end: Date;
      if (durationType === ReportDropDownTypes.CUSTOM && startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        const dateRange = getDateRange(
          durationType ?? ReportDropDownTypes.TODAY
        );
        start = new Date(dateRange.start);
        end = new Date(dateRange.end);
      }

      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);

      // Run all queries in parallel to get the counts
      const [
        applyleaveCount,
        approveLeaveCount,
        nightOutCount,
        nightCountAprovedCount,
        lateComingCount,
        lateComingAprovedCount,
      ] = await Promise.all([
        // Count of leave applications submitted within the date range
        StudentLeave.countDocuments({
          ...searchHostel,
          $or: [
            { startDate: { $lte: start }, endDate: { $gte: end } },
            {
              startDate: { $gte: start, $lte: end },
              endDate: { $gte: start, $lte: end },
            },
          ],
          leaveType: LeaveTypes.LEAVE,
        }),

        // Count of approved leave applications
        StudentLeave.countDocuments({
          ...searchHostel,
          $or: [
            { startDate: { $lte: start }, endDate: { $gte: end } },
            {
              startDate: { $gte: start, $lte: end },
              endDate: { $gte: start, $lte: end },
            },
          ],
          leaveStatus: LeaveStatusTypes.APPROVED,
          leaveType: LeaveTypes.LEAVE,
        }),

        // Count of night out applications submitted
        StudentLeave.countDocuments({
          ...searchHostel,
          $or: [
            { startDate: { $lte: start }, endDate: { $gte: end } },
            {
              startDate: { $gte: start, $lte: end },
              endDate: { $gte: start, $lte: end },
            },
          ],
          leaveType: LeaveTypes.DAY_OUT,
        }),

        // Count of approved night out applications
        StudentLeave.countDocuments({
          ...searchHostel,
          $or: [
            { startDate: { $lte: start }, endDate: { $gte: end } },
            {
              startDate: { $gte: start, $lte: end },
              endDate: { $gte: start, $lte: end },
            },
          ],
          leaveStatus: LeaveStatusTypes.APPROVED,
          leaveType: LeaveTypes.DAY_OUT,
        }),

        // Count of late coming applications submitted
        StudentLeave.countDocuments({
          ...searchHostel,
          $or: [
            { startDate: { $lte: start }, endDate: { $gte: end } },
            {
              startDate: { $gte: start, $lte: end },
              endDate: { $gte: start, $lte: end },
            },
          ],
          leaveType: LeaveTypes.LATE_COMING,
        }),

        // Count of approved late coming applications
        StudentLeave.countDocuments({
          ...searchHostel,
          $or: [
            { startDate: { $lte: start }, endDate: { $gte: end } },
            {
              startDate: { $gte: start, $lte: end },
              endDate: { $gte: start, $lte: end },
            },
          ],
          leaveStatus: LeaveStatusTypes.APPROVED,
          leaveType: LeaveTypes.LATE_COMING,
        }),
      ]);
      const result = {
        totalLeave: applyleaveCount + approveLeaveCount,
        applyleaveCount,
        approveLeaveCount,
        totalNightOut: nightOutCount + nightCountAprovedCount,
        nightOutCount,
        nightCountAprovedCount,
        totallateComing: lateComingCount + lateComingAprovedCount,
        lateComingCount,
        lateComingAprovedCount,
      };
      return { report: result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get leave Graph Count Summary
  leaveGraphCountSummary = async (
    hostelId: string,
    durationType: ReportDropDownTypes
  ): Promise<{ report: any }> => {
    try {
      // Create the hostel search condition if hostelId is provided
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

      // Get the date range based on the provided durationType
      const { start, end } = getDateRange(durationType);
      const { start: todayStart, end: todayEnd } = getDateRange(
        ReportDropDownTypes.TODAY
      );

      const today = new Date();

      // Function to generate aggregation for a given leave type
      const getLeaveCountByType = async (leaveType: string) => {
        return StudentLeave.aggregate([
          {
            $match: {
              ...searchHostel,
              $or: [
                {
                  startDate: { $lte: new Date(todayStart) },
                  endDate: { $gte: new Date(todayEnd) },
                },
                {
                  startDate: { $gte: new Date(start), $lte: new Date(end) },
                  endDate: { $gte: new Date(start), $lte: new Date(end) },
                },
              ],
              leaveStatus: LeaveStatusTypes.APPROVED,
              leaveType: leaveType,
            },
          },
          { $group: { _id: "$userId", totalLeaves: { $sum: 1 } } },
          { $group: { _id: null, uniqueUsers: { $sum: 1 } } },
        ]);
      };

      // Run all queries in parallel to optimize performance
      const [
        hostelDetails,
        activeUserCount,
        leaveCounts,
        lateComingCounts,
        dayNightOutCounts,
      ] = await Promise.all([
        Hostel.findById(hostelId).select("totalCapacity"), // Fetch hostel details
        User.countDocuments({
          isVerified: true,
          ...searchHostel,
          status: true,
        }), // Active users count
        getLeaveCountByType(LeaveTypes.LEAVE), // Leave count
        getLeaveCountByType(LeaveTypes.LATE_COMING), // Late coming count
        getLeaveCountByType(LeaveTypes.DAY_OUT), // Day/Night out count
      ]);

      // Calculate total present students (active users - students on leave)
      const totalPresent =
        activeUserCount - (leaveCounts?.[0]?.uniqueUsers ?? 0);

      // Structure the result as an array of objects
      const result = [
        { label: "Total Capacity", value: hostelDetails?.totalCapacity ?? 0 },
        { label: "Students Present", value: totalPresent ?? 0 },
        {
          label: "Student On Leave",
          value: leaveCounts?.[0]?.uniqueUsers ?? 0,
        },
        {
          label: "Late Coming",
          value: lateComingCounts?.[0]?.uniqueUsers ?? 0,
        },
        {
          label: "Day Out / Night Out",
          value: dayNightOutCounts?.[0]?.uniqueUsers ?? 0,
        },
        { label: "Absent", value: 0 }, // Placeholder for absentees
      ];

      return { report: result };
    } catch (error: any) {
      throw new Error(`${error.message}`);
    }
  };

  //SECTION: Method to export leave details
  exportLeaveDetails = async (
    hostelId: string,
    leaveStatus: LeaveStatusTypes,
    leaveType: LeaveTypes,
    type: ExportTypes,
    leaveIds?: string[],
    floorNumber?: number,
    roomNumber?: number,
    search?: string
  ): Promise<{ result: any[] }> => {
    try {
      // Initialize query with hostelId or leaveIds based on ExportType
      const query: any =
        type === ExportTypes.ALL ? { hostelId } : { _id: { $in: leaveIds } };

      // Add leaveType filter if provided
      if (leaveType && leaveType !== LeaveTypes.ALL) {
        query.leaveType = leaveType;
      } else if (leaveType === LeaveTypes.ALL) {
        query.leaveType = {
          $in: [LeaveTypes.DAY_OUT, LeaveTypes.LATE_COMING, LeaveTypes.LEAVE],
        };
      }

      // Add leaveStatus filter if provided
      if (leaveStatus && leaveStatus !== LeaveStatusTypes.ALL) {
        query.leaveStatus = leaveStatus;
      } else if (leaveStatus === LeaveStatusTypes.ALL) {
        query.leaveStatus = {
          $in: [
            LeaveStatusTypes.APPROVED,
            LeaveStatusTypes.CANCELLED,
            LeaveStatusTypes.PENDING,
            LeaveStatusTypes.REJECTED,
          ],
        };
      }

      const searchParams: any = {};

      let userIds: mongoose.Types.ObjectId[] = [];
      // Filtering by floor number or room number
      if (floorNumber || roomNumber) {
        const allocationQuery: any = {
          hostelId: new mongoose.Types.ObjectId(hostelId),
        };
        if (floorNumber) allocationQuery.floorNumber = floorNumber;
        if (roomNumber) allocationQuery.roomNumber = roomNumber;

        const allocatedUsers = await StudentHostelAllocation.find(
          allocationQuery
        ).select("studentId");
        userIds = allocatedUsers.map((entry) => entry.studentId);
      }

      // Filtering by user details
      if (search) {
        const searchAsNumber = !isNaN(Number(search)) ? Number(search) : null;

        const userQuery: any = {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { uniqueId: { $regex: search, $options: "i" } },
            ...(searchAsNumber ? [{ phone: searchAsNumber }] : []),
          ],
        };

        const users = await User.find(userQuery).select("_id");
        userIds = users.map((user) => user._id) as mongoose.Types.ObjectId[];
      }

      if ((search || floorNumber || roomNumber) && userIds) {
        searchParams.userId = {
          $in: userIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }

      // Execute the query and select necessary fields
      const leave = await StudentLeave.find({ ...query, ...searchParams })
        .populate([
          { path: "userId", select: "name" },
          { path: "hostelId", select: "name" },
          { path: "categoryId", select: "name" },
        ])
        .lean()
        .select("-__v -createdBy -updatedBy -updateLogs");

      // If no records found, throw an error
      if (!leave || leave.length === 0) {
        throw new Error(
          RECORD_NOT_FOUND(type === ExportTypes.ALL ? "Leaves" : "Leave")
        );
      }

      // Map the query results to the required format
      const result = leave.map((leave: any) => ({
        ticketId: leave?.ticketId ? `'${leave.ticketId}'` : null,
        gatepassNumber: leave?.gatepassNumber
          ? `'${leave.gatepassNumber}'`
          : null,
        userName: leave?.userId?.name,
        category: leave?.categoryId?.name,
        hostel: leave?.hostelId?.name,
        startDate: moment(leave?.startDate).format("YYYY-MM-DD"),
        endDate: moment(leave?.endDate).format("YYYY-MM-DD"),
        days: leave?.days,
        hours: leave?.hours,
        description: leave?.description,
        visitorName: leave?.visitorName,
        visitorNumber: leave?.visitorNumber,
        leaveStatus: leave?.leaveStatus,
        approvalStatus: leave?.approvalStatus,
        approvedDate: moment(leave?.approvedDate).format("YYYY-MM-DD"),
        cancelledDate: leave?.cancelledDate,
        leaveType: leave?.leaveType,
      }));

      return { result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };
}

export default new LeaveReportService();
