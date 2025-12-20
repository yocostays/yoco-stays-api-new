import mongoose from "mongoose";
import StudentLeave, { IStudentLeave } from "../models/student-leave.model";
import User from "../models/user.model";
import Notice from "../models/notice.model";
import moment from "moment";
import StudentHostelAllocation from "../models/studentHostelAllocation.model";
import UserService from "./user.service";
import {
  LeaveApproveStatusTypes,
  LeaveStatusTypes,
  LeaveTypes,
  NoticeTypes,
  PushNotificationTypes,
  ReportDropDownTypes,
  SortingTypes,
  TemplateTypes,
} from "../utils/enum";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../utils/messages";
import {
  formatDateOnly,
  getCurrentISTTime,
  getDateRange,
  populateTemplate,
} from "../utils/lib";
import { getSignedUrl } from "../utils/awsUploadService";
import { sendPushNotificationToUser } from "../utils/commonService/pushNotificationService";
const { UPDATE_DATA } = SUCCESS_MESSAGES;
const {
  RECORD_NOT_FOUND,
  LEAVE_APPLY,
  LEAVE_STATUS_UPDATE,
  UNIQUE_GENERATE_FAILED,
  LEAVE_APPROVE_ERROR,
  INVALID_STATUS,
  INVALID_DATE_RANGE,
} = ERROR_MESSAGES;
const { fetchPlayerNotificationConfig, getStudentAllocatedHostelDetails } =
  UserService;

class StudentLeaveService {
  //SECTION: Method to create apply leave in app
  applyleaveFromApp = async (
    userId: string,
    hostelId: string,
    categoryId: string,
    startDate: Date,
    endDate: Date,
    days: number,
    hours: number,
    description: string
  ): Promise<IStudentLeave> => {
    try {
      const leaveStartDate = new Date(startDate);
      leaveStartDate.setUTCHours(0, 0, 0, 0);

      const leaveEndDate = new Date(endDate);
      leaveEndDate.setUTCHours(23, 59, 59, 999);

      // Check if a leave already exists for the student within the same range or overlapping dates
      const existingLeave = await StudentLeave.findOne({
        userId,
        $or: [
          {
            startDate: { $lte: leaveStartDate },
            endDate: { $gte: leaveEndDate },
          },
          {
            startDate: { $gte: leaveStartDate, $lte: leaveEndDate },
            endDate: { $gte: leaveStartDate, $lte: leaveEndDate },
          },
        ],
        leaveType: LeaveTypes.LEAVE,
        leaveStatus: {
          $in: [LeaveStatusTypes.APPROVED, LeaveStatusTypes.PENDING],
        },
      });

      if (existingLeave) throw new Error(LEAVE_APPLY);

      // Generate a new 6-digit ticketId
      const ticketId = await this.generateLeaveTicketId();

      // Create new leave with 3 initial update log entries for each approval stage
      const newLeave = await StudentLeave.create({
        ticketId,
        userId,
        hostelId,
        categoryId,
        startDate,
        endDate,
        days,
        hours,
        description,
        leaveStatus: LeaveStatusTypes.PENDING,
        approvalStatus: LeaveApproveStatusTypes.PENDING_APPROVAL,
        createdBy: userId,
        updateLogs: [
          {
            leaveStatus: LeaveStatusTypes.PENDING,
            approvalStatus: LeaveApproveStatusTypes.PARENT,
          },
          {
            leaveStatus: LeaveStatusTypes.PENDING,
            approvalStatus: LeaveApproveStatusTypes.HOD,
          },
          {
            leaveStatus: LeaveStatusTypes.PENDING,
            approvalStatus: LeaveApproveStatusTypes.WARDEN,
          },
        ],
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      //NOTE: Check user leave applied or not.
      if (newLeave) {
        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await fetchPlayerNotificationConfig(
            userId,
            TemplateTypes.LEAVE_REQUEST_SUBMITTED
          );
        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await getStudentAllocatedHostelDetails(
            student?._id,
            student?.hostelId,
            TemplateTypes.LEAVE_REQUEST_SUBMITTED
          );

        //NOTE: Final notice created check.
        const finalNoticeCreated =
          isPlayedNoticeCreated && isHostelNoticeCreated;

        // NOTE: Combine available logs into an array
        const notificationLog = [log, hostelLogs].filter(Boolean);

        //NOTE: Retrieve only the date section from date & time.
        const fromDate = formatDateOnly(startDate);
        const toDate = formatDateOnly(endDate);

        const dynamicData = {
          fromDate,
          toDate,
        };
        //NOTE: Add details for dynamic message using the populateTemplate.
        const description = template?.description
          ? populateTemplate(template.description, dynamicData)
          : "Your leave request has been submitted successfully.";

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
            TemplateTypes.LEAVE_REQUEST_SUBMITTED
          );
        }
      }
      // Return new leave
      return newLeave;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get all user leave by status
  async userLeaveByStatus(
    userId: string,
    page: number,
    limit: number,
    type: LeaveTypes,
    status: LeaveStatusTypes
  ): Promise<{ leaves: any[]; count: number }> {
    try {
      const skip = (page - 1) * limit;

      // Define the base query object
      const query: any = {
        userId: new mongoose.Types.ObjectId(userId),
        leaveStatus: status,
        status: true,
      };

      // Add leaveType conditionally based on the type parameter
      if (type !== LeaveTypes.ALL) {
        query.leaveType = type;
      }

      // Run both queries in parallel
      const [count, leave] = await Promise.all([
        StudentLeave.countDocuments(query),
        StudentLeave.find(query)
          .populate([
            { path: "categoryId", select: "name" },
            { path: "updatedBy", select: "name" },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      // If no leaves are found, return empty array and count 0
      if (count === 0 && !leave.length) {
        return { leaves: [], count: 0 };
      }

      // Process the results to format the response
      const response = leave.map((ele: any) => ({
        _id: ele._id,
        ticketId: ele?.ticketId ?? null,
        category: ele?.categoryId?.name,
        startDate: ele?.startDate,
        endDate: ele?.endDate,
        leaveType: ele?.leaveType,
        days: ele?.days,
        hours: ele?.hours,
        visitorName: ele?.visitorName,
        visitorNumber: ele?.visitorNumber,
        description: ele?.description,
        leaveStatus: ele?.leaveStatus,
        approvalStatus: ele?.approvalStatus,
        approvedDate: ele?.approvedDate,
        applyDate: ele?.createdAt,
      }));

      return { leaves: response, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get leave Logs
  async userLeaveLogs(leaveId: string): Promise<{ logs: any[] }> {
    try {
      // Find the specific leave by leaveId
      const leave = await StudentLeave.findById(leaveId)
        .select("updateLogs")
        .populate([{ path: "updateLogs.updatedBy", select: "name" }])
        .lean();

      // Check if the leave entry was found
      if (!leave) {
        throw new Error(RECORD_NOT_FOUND("Leave"));
      }

      // Process the logs if they exist
      const logs = (leave.updateLogs || []).map((log: any) => ({
        _id: log._id,
        leaveStatus: log.leaveStatus,
        approvalStatus: log.approvalStatus,
        date: log.date ?? null,
        remark: log.remark ?? null,
        updatedBy: log.updatedBy?.name ?? null,
      }));

      return { logs };
    } catch (error: any) {
      throw new Error(`Failed to retrieve logs: ${error.message}`);
    }
  }

  //SECTION: Method to get All Leave By Staff Role
  getAllLeaveByStaffRole = async (
    page: number,
    limit: number,
    status: LeaveTypes,
    role: string,
    hostelId?: string,
    leaveStatus?: LeaveStatusTypes,
    search?: string,
    sort?: SortingTypes,
    floorNumber?: string,
    roomNumber?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ details: any[]; count: number }> => {
    try {
      const skip = (page - 1) * limit;
      const searchParams: any = {};

      if (!/super admin/i.test(role) && hostelId) {
        searchParams.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

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
        searchParams.userId = { $in: userIds };
      }

      const sortOptions: any = {};
      const leaveDateFilter: any = {};

      switch (sort) {
        case SortingTypes.RECENT:
          sortOptions.createdAt = -1;
          break;
        case SortingTypes.OLDEST:
          sortOptions.createdAt = 1;
          break;
        case SortingTypes.CUSTOM:
          sortOptions.createdAt = -1;
          if (!startDate || !endDate) {
            throw new Error(INVALID_DATE_RANGE);
          }
          const formatedStartDate = new Date(startDate);
          formatedStartDate.setUTCHours(0, 0, 0, 0);

          const formatedEndDate = new Date(endDate);
          formatedEndDate.setUTCHours(23, 59, 59, 999);

          // Custom filtering based on date range
          leaveDateFilter.$or = [
            {
              startDate: { $lte: formatedEndDate },
              endDate: { $gte: formatedStartDate },
            },
            {
              startDate: { $gte: formatedStartDate, $lte: formatedEndDate },
              endDate: { $gte: formatedStartDate, $lte: formatedEndDate },
            },
          ];
          break;
        default:
          sortOptions.createdAt = -1;
      }

      const statusParams: any = {};
      switch (leaveStatus) {
        case LeaveStatusTypes.ALL:
          break;
        case LeaveStatusTypes.APPROVED:
          statusParams.leaveStatus = LeaveStatusTypes.APPROVED;
          break;
        case LeaveStatusTypes.CANCELLED:
          statusParams.leaveStatus = LeaveStatusTypes.CANCELLED;
          break;
        case LeaveStatusTypes.PENDING:
          statusParams.leaveStatus = LeaveStatusTypes.PENDING;
          break;
        case LeaveStatusTypes.REJECTED:
          statusParams.leaveStatus = LeaveStatusTypes.REJECTED;
          break;
        default:
          throw new Error(INVALID_STATUS);
      }

      const [count, leaves] = await Promise.all([
        StudentLeave.countDocuments({
          leaveType: status,
          ...searchParams,
          ...statusParams,
          ...leaveDateFilter,
        }),
        StudentLeave.find({
          leaveType: status,
          ...searchParams,
          ...statusParams,
          ...leaveDateFilter,
        })
          .populate([
            { path: "userId", select: "name email phone uniqueId image" },
            { path: "hostelId", select: "name" },
            { path: "categoryId", select: "name" },
            { path: "updatedBy", select: "name" },
          ])
          .sort(sortOptions)
          .skip(skip)
          .limit(limit),
      ]);

      const response = await Promise.all(
        leaves.map(async (ele: any) => {
          const hostelDetails = await StudentHostelAllocation.findOne({
            studentId: ele?.userId?._id,
            hostelId: ele?.hostelId?._id,
            status: true,
          }).select("bedType roomNumber bedNumber floorNumber");

          return {
            _id: ele._id,
            uniqueId: ele?.userId?.uniqueId ?? null,
            ticketId: ele.ticketId,
            userId: ele?.userId?._id ?? null,
            name: ele?.userId?.name ?? null,
            email: ele?.userId?.email ?? null,
            phone: ele?.userId?.phone ?? null,
            image: ele?.userId?.image
              ? await getSignedUrl(ele?.userId?.image)
              : null,
            bedType: hostelDetails?.bedType ?? null,
            roomNumber: hostelDetails?.roomNumber ?? null,
            floorNumber: hostelDetails?.floorNumber ?? null,
            bedNumber: hostelDetails?.bedNumber ?? null,
            hostelId: ele?.hostelId?._id ?? null,
            hostelName: ele?.hostelId?.name ?? null,
            categoryId: ele?.categoryId?._id ?? null,
            categoryName: ele?.categoryId?.name ?? null,
            startDate: ele?.startDate ?? null,
            endDate: ele?.endDate ?? null,
            days: ele?.days ?? null,
            hours: ele?.hours ?? null,
            description: ele?.description ?? null,
            visitorName: ele?.visitorName ?? null,
            visitorNumber: ele?.visitorNumber ?? null,
            leaveStatus: ele?.leaveStatus ?? null,
            approvalStatus: ele?.approvalStatus ?? null,
            approvedDate: ele?.approvedDate ?? null,
            leaveType: ele?.leaveType ?? null,
            updatedBy: ele?.updatedBy?.name ?? null,
            createdAt: ele?.createdAt ?? null,
          };
        })
      );

      // Manual Sorting based on `userId.name`
      if (sort === SortingTypes.ASCENDING) {
        response.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      } else if (sort === SortingTypes.DESCENDING) {
        response.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
      }

      return { count, details: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get leave details by Id
  async leaveDetailsById(leaveId: string): Promise<{ leave: any }> {
    try {
      const leave = await StudentLeave.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(leaveId) } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "hostels",
            localField: "hostelId",
            foreignField: "_id",
            as: "hostel",
          },
        },
        { $unwind: { path: "$hostel", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "leavecategories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "staffs",
            localField: "updatedBy",
            foreignField: "_id",
            as: "updatedByUser",
          },
        },
        {
          $unwind: { path: "$updatedByUser", preserveNullAndEmptyArrays: true },
        },
        {
          $lookup: {
            from: "staffs",
            localField: "updateLogs.updatedBy",
            foreignField: "_id",
            as: "updateLogsPopulated",
          },
        },
        {
          $addFields: {
            updateLogs: {
              $map: {
                input: "$updateLogs",
                as: "log",
                in: {
                  leaveStatus: "$$log.leaveStatus",
                  approvalStatus: "$$log.approvalStatus",
                  date: "$$log.date",
                  remark: "$$log.remark",
                  name: {
                    $let: {
                      vars: {
                        matchedUser: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$updateLogsPopulated",
                                cond: {
                                  $eq: ["$$this._id", "$$log.updatedBy"],
                                },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: { $ifNull: ["$$matchedUser.name", null] },
                    },
                  },
                },
              },
            },
          },
        },
        {
          $lookup: {
            from: "studenthostelallocations",
            let: { userId: "$user._id", hostelId: "$hostel._id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$studentId", "$$userId"] },
                      { $eq: ["$hostelId", "$$hostelId"] },
                      { $eq: ["$status", true] },
                    ],
                  },
                },
              },
              {
                $project: {
                  bedType: 1,
                  floorNumber: 1,
                  roomNumber: 1,
                  bedNumber: 1,
                },
              },
            ],
            as: "hostelDetails",
          },
        },
        {
          $unwind: { path: "$hostelDetails", preserveNullAndEmptyArrays: true },
        },
        {
          $project: {
            _id: 1,
            ticketId: 1,
            uniqueId: { $ifNull: ["$user.uniqueId", null] },
            userId: { $ifNull: ["$user._id", null] },
            name: { $ifNull: ["$user.name", null] },
            email: { $ifNull: ["$user.email", null] },
            phone: { $ifNull: ["$user.phone", null] },
            image: { $ifNull: ["$user.image", null] },
            bedType: { $ifNull: ["$hostelDetails.bedType", null] },
            floorNumber: { $ifNull: ["$hostelDetails.floorNumber", null] },
            roomNumber: { $ifNull: ["$hostelDetails.roomNumber", null] },
            bedNumber: { $ifNull: ["$hostelDetails.bedNumber", null] },
            hostelName: { $ifNull: ["$hostel.name", null] },
            categoryName: { $ifNull: ["$category.name", null] },
            startDate: { $ifNull: ["$startDate", null] },
            endDate: { $ifNull: ["$endDate", null] },
            days: { $ifNull: ["$days", null] },
            hours: { $ifNull: ["$hours", null] },
            visitorName: { $ifNull: ["$visitorName", null] },
            visitorNumber: { $ifNull: ["$visitorNumber", null] },
            leaveStatus: { $ifNull: ["$leaveStatus", null] },
            approvalStatus: { $ifNull: ["$approvalStatus", null] },
            approvedDate: { $ifNull: ["$approvedDate", null] },
            leaveType: { $ifNull: ["$leaveType", null] },
            description: { $ifNull: ["$description", null] },
            "updatedByUser.name": 1,
            updateLogs: 1,
            createdAt: { $ifNull: ["$createdAt", null] },
          },
        },
      ]);

      if (!leave || leave.length === 0) {
        throw new Error(RECORD_NOT_FOUND("Leave"));
      }

      // Fetch the next leave ID
      const nextLeave: any = await StudentLeave.findOne(
        {
          _id: { $gt: new mongoose.Types.ObjectId(leaveId) },
          leaveType: leave[0].leaveType,
        },
        { _id: 1 }
      ).sort({ _id: 1 });

      // Fetch the previous leave ID
      const previousLeave: any = await StudentLeave.findOne(
        {
          _id: { $lt: new mongoose.Types.ObjectId(leaveId) },
          leaveType: leave[0].leaveType,
        },
        { _id: 1 }
      ).sort({ _id: -1 });

      const nextLeaveId = nextLeave ? nextLeave._id.toString() : null;
      const previousLeaveId = previousLeave
        ? previousLeave._id.toString()
        : null;

      const processedLeave = {
        ...leave[0],
        image: leave[0].image ? await getSignedUrl(leave[0].image) : null,
        nextLeaveId,
        previousLeaveId,
      };

      return { leave: processedLeave };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to create apply outing in app
  applyOutingFromApp = async (
    leaveType: LeaveTypes,
    userId: string,
    hostelId: string,
    startDate: Date,
    endDate: Date,
    hours: string,
    description: string,
    visitorName?: string,
    visitorNumber?: number,
    categoryId?: string
  ): Promise<IStudentLeave> => {
    try {
      const leaveStartDate = new Date(startDate);
      leaveStartDate.setUTCHours(0, 0, 0, 0);

      const leaveEndDate = new Date(endDate);
      leaveEndDate.setUTCHours(23, 59, 59, 999);

      // Check if a leave already exists for the student within the same range or overlapping dates
      const existingLeave = await StudentLeave.findOne({
        userId,
        $or: [
          {
            startDate: { $lte: leaveStartDate },
            endDate: { $gte: leaveEndDate },
          },
          {
            startDate: { $gte: leaveStartDate, $lte: leaveEndDate },
            endDate: { $gte: leaveStartDate, $lte: leaveEndDate },
          },
        ],
        leaveStatus: {
          $in: [LeaveStatusTypes.APPROVED, LeaveStatusTypes.PENDING],
        },
      });

      if (existingLeave) throw new Error(LEAVE_APPLY);

      // Generate a new 6-digit ticketId
      const ticketId = await this.generateLeaveTicketId();

      // Create new leave with 3 initial update log entries for each approval stage
      const newLeave = await StudentLeave.create({
        ticketId,
        userId,
        categoryId,
        hostelId,
        startDate,
        endDate,
        hours,
        description,
        visitorName,
        visitorNumber,
        leaveStatus: LeaveStatusTypes.PENDING,
        leaveType,
        approvalStatus: LeaveApproveStatusTypes.PENDING_APPROVAL,
        createdBy: userId,
        updateLogs: [
          {
            leaveStatus: LeaveStatusTypes.PENDING,
            approvalStatus: LeaveApproveStatusTypes.PARENT,
          },
          {
            leaveStatus: LeaveStatusTypes.PENDING,
            approvalStatus: LeaveApproveStatusTypes.HOD,
          },
          {
            leaveStatus: LeaveStatusTypes.PENDING,
            approvalStatus: LeaveApproveStatusTypes.WARDEN,
          },
        ],
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      //NOTE: Check user leave applied or not.
      if (newLeave) {
        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await fetchPlayerNotificationConfig(
            userId,
            TemplateTypes.LEAVE_REQUEST_SUBMITTED
          );
        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await getStudentAllocatedHostelDetails(
            student?._id,
            student?.hostelId,
            TemplateTypes.LEAVE_REQUEST_SUBMITTED
          );

        //NOTE: Final notice created check.
        const finalNoticeCreated =
          isPlayedNoticeCreated && isHostelNoticeCreated;

        // NOTE: Combine available logs into an array
        const notificationLog = [log, hostelLogs].filter(Boolean);

        //NOTE: Retrieve only the date section from date & time.
        const fromDate = formatDateOnly(startDate);
        const toDate = formatDateOnly(endDate);

        const dynamicData = {
          fromDate,
          toDate,
        };
        //NOTE: Add details for dynamic message using the populateTemplate.
        const description = template?.description
          ? populateTemplate(template.description, dynamicData)
          : "Your outing request has been submitted successfully.";

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
            TemplateTypes.LEAVE_REQUEST_SUBMITTED
          );
        }
      }

      // Save the new leave to the database
      return newLeave;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to update leave status
  updateLeaveStatus = async (
    staffId: string,
    leaveId: string,
    status: LeaveStatusTypes,
    remark: string
  ): Promise<string> => {
    try {
      // Find the specific leave by leaveId
      const leave = await StudentLeave.findById(leaveId);
      if (!leave) throw new Error(RECORD_NOT_FOUND("Leave"));

      // if (status !== LeaveStatusTypes.CANCELLED) {
      //   throw new Error(LEAVE_STATUS_UPDATE(`${leave.leaveStatus}`));
      // }

      let gatepassNumber: string | null = null;

      if (status === LeaveStatusTypes.APPROVED) {
        gatepassNumber = await this.generateGatepassNumber();
      }

      // Prepare the update object
      const updateData: any = {
        $set: {
          leaveStatus: status,
          approvalStatus: LeaveApproveStatusTypes.WARDEN,
          approvedDate: getCurrentISTTime(),
          updatedBy: staffId,
          "updateLogs.$[log].leaveStatus": status,
          "updateLogs.$[log].date": getCurrentISTTime(),
          "updateLogs.$[log].remark": remark,
          "updateLogs.$[log].updatedBy": staffId,
          ...(gatepassNumber && { gatepassNumber }),
        },
      };

      // If the leave is cancelled, add the cancelledDate field
      if (status === LeaveStatusTypes.CANCELLED) {
        updateData.$set.cancelledDate = getCurrentISTTime();
      }

      const studentLeave: any = await StudentLeave.findByIdAndUpdate(
        leave._id,
        updateData,
        {
          arrayFilters: [
            { "log.approvalStatus": LeaveApproveStatusTypes.WARDEN },
          ],
        }
      );

      //NOTE: Send notification when leave is approved or rejected
      if (studentLeave) {
        //NOTE: Dynamically select the appropriate template type based on leave status.
        const templateType =
          status === LeaveStatusTypes.APPROVED
            ? TemplateTypes.LEAVE_APPROVED
            : TemplateTypes.LEAVE_REJECTED;

        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await fetchPlayerNotificationConfig(
            studentLeave?.createdBy,
            templateType
          );

        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await getStudentAllocatedHostelDetails(
            student?._id,
            student?.hostelId,
            templateType
          );

        //NOTE: Final notice created check.
        const finalNoticeCreated =
          isPlayedNoticeCreated && isHostelNoticeCreated;

        // NOTE: Combine available logs into an array
        const notificationLog = [log, hostelLogs].filter(Boolean);

        //NOTE: Retrieve only the date section from date & time.
        const fromDate = formatDateOnly(studentLeave?.startDate);
        const toDate = formatDateOnly(studentLeave?.endDate);

        const dynamicData = {
          fromDate,
          toDate,
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
            templateType
          );
        }
      }
      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get leave details by Id
  approvedLeaveDetailsById = async (
    leaveId: string
  ): Promise<{ leave: any }> => {
    try {
      const [leave] = await StudentLeave.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(leaveId) } },
        {
          $project: {
            _id: 1,
            leaveStatus: 1,
            gatepassNumber: 1,
            description: 1,
          },
        },
      ]);

      if (!leave) throw new Error(RECORD_NOT_FOUND("Leave"));

      if (leave.leaveStatus !== LeaveStatusTypes.APPROVED)
        throw new Error(LEAVE_APPROVE_ERROR);

      return { leave };
    } catch (error: any) {
      throw new Error(`${error.message}`);
    }
  };

  //SECTION: Method cancelled leave by id
  cancelLeaveById = async (
    leaveId: string,
    userId: string
  ): Promise<string> => {
    try {
      // Find the specific leave by leaveId
      const leave = await StudentLeave.findOne({
        _id: new mongoose.Types.ObjectId(leaveId),
        userId: new mongoose.Types.ObjectId(userId),
      })
        .select("updateLogs leaveStatus cancelledDate")
        .lean();

      if (!leave) throw new Error(RECORD_NOT_FOUND("Leave"));

      // Check if the leave is already canceled
      if (
        leave.leaveStatus === LeaveStatusTypes.CANCELLED ||
        leave.leaveStatus === LeaveStatusTypes.APPROVED
      )
        throw new Error(`Leave is already ${leave.leaveStatus}.`);

      const studentLeave: any = await StudentLeave.findByIdAndUpdate(
        leaveId,
        {
          leaveStatus: LeaveStatusTypes.CANCELLED,
          cancelledDate: getCurrentISTTime(),
          $push: {
            updateLogs: {
              leaveStatus: LeaveStatusTypes.CANCELLED,
              approvalStatus: LeaveApproveStatusTypes.STUDENT,
              date: getCurrentISTTime(),
              remark: "Leave canceled by user.",
              updatedBy: userId,
            },
          },
        },
        { new: true }
      );
      //NOTE: Check user leave applied or not.
      if (studentLeave) {
        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await fetchPlayerNotificationConfig(
            studentLeave?.createdBy,
            TemplateTypes.LEAVE_CANCELLED
          );

        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await getStudentAllocatedHostelDetails(
            student?._id,
            student?.hostelId,
            TemplateTypes.LEAVE_CANCELLED
          );

        //NOTE: Final notice created check.
        const finalNoticeCreated =
          isPlayedNoticeCreated && isHostelNoticeCreated;

        // NOTE: Combine available logs into an array
        const notificationLog = [log, hostelLogs].filter(Boolean);

        //NOTE: Retrieve only the date section from date & time.
        const fromDate = formatDateOnly(studentLeave?.startDate);
        const toDate = formatDateOnly(studentLeave?.endDate);

        const dynamicData = {
          fromDate,
          toDate,
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
            TemplateTypes.LEAVE_CANCELLED
          );
        }
      }
      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(`Failed to update leave as canceled: ${error.message}`);
    }
  };

  //SECTION: Method to fetch Indivisual User Leave
  async fetchIndividualUserLeaveDetails(
    userId: string,
    page: number,
    limit: number,
    status: LeaveTypes,
    leaveStatus?: LeaveStatusTypes,
    durationType?: ReportDropDownTypes,
    startDate?: string,
    endDate?: string
  ): Promise<{ leaves: any[]; count: number }> {
    try {
      const skip = (page - 1) * limit;

      // Base query
      const query: any = {
        userId: new mongoose.Types.ObjectId(userId),
        leaveType: status,
        status: true,
      };

      // If leaveStatus is not 'all', add it to the query
      if (leaveStatus && leaveStatus !== LeaveStatusTypes.ALL) {
        query.leaveStatus = leaveStatus;
      }

      // Get the date range based on the provided durationType
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
        // Else get the date range based on the durationType
        const range = durationType
          ? getDateRange(durationType as ReportDropDownTypes) || {
            start: null,
            end: null,
          }
          : { start: null, end: null };

        start = range.start ? new Date(range.start) : null;
        end = range.end ? new Date(range.end) : null;
      }

      // Add startDate and endDate filters if both are defined
      if (start && end) {
        query.$or = [
          {
            startDate: { $lte: start },
            endDate: { $gte: end },
          },
          {
            startDate: { $gte: start, $lte: end },
            endDate: { $gte: start, $lte: end },
          },
        ];
      }

      // Fetch count and leave data in parallel
      const [count, leaves] = await Promise.all([
        StudentLeave.countDocuments(query),
        StudentLeave.find(query)
          .populate([
            { path: "userId", select: "name image uniqueId image" },
            { path: "categoryId", select: "name" },
            { path: "updatedBy", select: "name" },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      if (!count) return { leaves: [], count: 0 };

      // Get current date and time in UTC
      const currentTime = getCurrentISTTime();

      // Map leave data to the desired structure with `isCanEdit`
      const response = await Promise.all(
        leaves.map(async (leave: any) => {
          // Convert startDate to UTC moment
          const startDate = moment.utc(leave.startDate);

          const canEdit =
            leave.leaveStatus === LeaveStatusTypes.APPROVED &&
            startDate.diff(currentTime, "hours") >= 12;

          const hostelDetails = await StudentHostelAllocation.findOne({
            studentId: leave?.userId?._id,
            hostelId: leave?.hostelId,
            status: true,
          }).select("bedType roomNumber bedNumber floorNumber");

          return {
            _id: leave._id,
            bedType: hostelDetails?.bedType ?? null,
            roomNumber: hostelDetails?.roomNumber ?? null,
            floorNumber: hostelDetails?.floorNumber ?? null,
            bedNumber: hostelDetails?.bedNumber ?? null,
            ticketId: leave?.ticketId ?? null,
            userId: leave?.userId?._id,
            name: leave?.userId?.name,
            uniqueId: leave?.userId?.uniqueId,
            image: leave?.userId?.image
              ? await getSignedUrl(leave?.userId?.image)
              : null,
            category: leave?.categoryId?.name,
            startDate: leave?.startDate,
            endDate: leave?.endDate,
            leaveType: leave?.leaveType,
            days: leave?.days,
            hours: leave?.hours,
            visitorName: leave?.visitorName,
            visitorNumber: leave?.visitorNumber,
            description: leave?.description,
            leaveStatus: leave?.leaveStatus,
            approvalStatus: leave?.approvalStatus,
            approvedDate: leave?.approvedDate,
            applyDate: leave?.createdAt,
            canEdit,
          };
        })
      );

      return { leaves: response, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to bulk Update Leave Status
  bulkUpdateLeaveStatus = async (
    staffId: string,
    leaves: { leaveId: string; status: LeaveStatusTypes; remark: string }[]
  ): Promise<string> => {
    try {
      const bulkOperations = await Promise.all(
        leaves.map(async ({ leaveId, status, remark }) => {
          const leave = await StudentLeave.findById(leaveId);

          if (!leave) throw new Error(RECORD_NOT_FOUND("Leave"));

          if (leave.leaveStatus !== LeaveStatusTypes.PENDING)
            throw new Error(LEAVE_STATUS_UPDATE(`${leave.leaveStatus}`));

          let gatepassNumber: string | null = null;

          if (status === LeaveStatusTypes.APPROVED) {
            gatepassNumber = await this.generateGatepassNumber();
          }

          return {
            updateOne: {
              filter: {
                _id: leaveId,
                leaveStatus: LeaveStatusTypes.PENDING,
              },
              update: {
                $set: {
                  leaveStatus: status,
                  approvalStatus: LeaveApproveStatusTypes.WARDEN,
                  approvedDate: getCurrentISTTime(),
                  updatedBy: staffId,
                  "updateLogs.$[log].leaveStatus": status,
                  "updateLogs.$[log].date": getCurrentISTTime(),
                  "updateLogs.$[log].remark": remark,
                  "updateLogs.$[log].updatedBy": staffId,
                  ...(gatepassNumber && { gatepassNumber }),
                },
              },
              arrayFilters: [
                { "log.approvalStatus": LeaveApproveStatusTypes.WARDEN },
              ],
            },
          };
        })
      );

      // Execute bulkWrite operation
      const result = await StudentLeave.bulkWrite(bulkOperations, {
        ordered: false,
      });

      if (result.modifiedCount === 0) {
        throw new Error(
          "No leave statuses were updated. Check if all leave IDs are valid and in pending state."
        );
      }

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(`Failed to update leave status: ${error.message}`);
    }
  };

  //SECTION: Method to fetch Indivisual User Leave
  async retrieveStudentCurrentlyOut(
    hostelId: string,
    search?: string,
    durationType?: ReportDropDownTypes,
    startDate?: string,
    endDate?: string
  ): Promise<{ users: any[] }> {
    try {
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

      // Base query to filter approved leaves within the given date ranges
      const query: any = {
        hostelId: new mongoose.Types.ObjectId(hostelId),
        leaveStatus: LeaveStatusTypes.APPROVED,
        $or: [
          {
            startDate: { $lte: new Date(start) },
            endDate: { $gte: new Date(end) },
          },
          {
            startDate: { $gte: new Date(start), $lte: new Date(end) },
            endDate: { $gte: new Date(start), $lte: new Date(end) },
          },
        ],
        status: true,
      };

      let userIds: mongoose.Types.ObjectId[] = [];
      if (search) {
        const searchAsNumber = !isNaN(Number(search)) ? Number(search) : null;

        // Build a search query for the User model
        const userQuery: any = {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { uniqueId: { $regex: search, $options: "i" } },
            ...(searchAsNumber ? [{ phone: searchAsNumber }] : []),
          ],
        };

        // Find matching users
        const users = await User.find(userQuery).select("_id"); // Only fetch userIds

        // Extract userIds from the users found
        userIds = users.map((user: any) => user._id);
      }

      if (userIds.length) {
        query.userId = { $in: userIds };
      }

      // Fetch leave data with populated fields
      const leaves = await StudentLeave.find(query)
        .populate("userId", "name image email phone uniqueId")
        .sort({ createdAt: -1 });

      // Return an empty response if no leaves are found
      if (!leaves.length) return { users: [] };

      // Map the leave data to the desired user structure
      const users = await Promise.all(
        leaves.map(async (leave: any) => ({
          _id: leave._id,
          userId: leave?.userId?._id,
          name: leave?.userId?.name,
          uniqueId: leave?.userId?.uniqueId,
          image: leave?.userId?.image
            ? await getSignedUrl(leave.userId.image)
            : null,
          startDate: leave?.startDate,
          endDate: leave?.endDate,
          leaveType: leave?.leaveType,
          leaveStatus: leave?.leaveStatus,
        }))
      );

      return { users };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //ANCHOR - generate Gate pass Number
  generateGatepassNumber = async (): Promise<string> => {
    try {
      const lastLeave: any = await StudentLeave.findOne({
        // leaveType: LeaveTypes.DAY_OUT,
        leaveStatus: LeaveStatusTypes.APPROVED,
        gatepassNumber: { $exists: true },
      })
        .sort({ gatepassNumber: -1 })
        .select("gatepassNumber");

      let newGatepassNumber = "001";

      if (lastLeave && lastLeave.gatepassNumber) {
        const lastNumber = parseInt(lastLeave.gatepassNumber, 10);
        const nextNumber = lastNumber + 1;
        newGatepassNumber = String(nextNumber).padStart(3, "0");
      }

      return newGatepassNumber;
    } catch (error) {
      throw new Error(UNIQUE_GENERATE_FAILED);
    }
  };

  //ANCHOR - generate Ticket Id
  generateLeaveTicketId = async (): Promise<string> => {
    try {
      // Get the latest ticketId from the database
      const latestLeave = await StudentLeave.findOne({
        ticketId: { $exists: true },
      })
        .sort({ ticketId: -1 })
        .select("ticketId")
        .exec();

      if (latestLeave && latestLeave.ticketId) {
        // Increment the latest ticketId by 1
        const latestId = parseInt(latestLeave.ticketId, 10);
        const ticketId = latestId + 1;

        // Return the new ticketId, formatted as a 7-digit string with leading zeros
        return String(ticketId).padStart(6, "0");
      } else {
        // If no ticketId exists, start with "000001"
        return "000001";
      }
    } catch (error) {
      throw new Error(UNIQUE_GENERATE_FAILED);
    }
  };
}

export default new StudentLeaveService();
