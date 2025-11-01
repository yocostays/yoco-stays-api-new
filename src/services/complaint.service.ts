import mongoose from "mongoose";
import StudentLeave from "../models/student-leave.model";
import Complaint from "../models/complaint.model";
import ComplainCategory from "../models/complaint-category.model";
import Role from "../models/role.model";
import User from "../models/user.model";
import Staff from "../models/staff.model";
import StudentHostelAllocation from "../models/studentHostelAllocation.model";
import UserService from "./user.service";

import {
  ComplainStatusTypes,
  ComplaintTypes,
  LeaveStatusTypes,
  NoticeTypes,
  PushNotificationTypes,
  ReportDropDownTypes,
  SortingTypes,
  TemplateTypes,
} from "../utils/enum";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../utils/messages";
import {
  getCurrentISTTime,
  getDateRange,
  populateTemplate,
} from "../utils/lib";
import { getSignedUrl } from "../utils/awsUploadService";
import { sendPushNotificationToUser } from "../utils/commonService/pushNotificationService";
import Notice from "../models/notice.model";
const { CREATE_DATA, UPDATE_DATA } = SUCCESS_MESSAGES;
const {
  RECORD_NOT_FOUND,
  COMPLAINT_ALREADY_RESOLVED,
  COMPLAIN_APPLY_ERROR,
  COMPLAINT_UPDATE_ERROR,
  NO_ASSIGNED_STAFF,
} = ERROR_MESSAGES;
const { fetchPlayerNotificationConfig, getStudentAllocatedHostelDetails } =
  UserService;

class ComplaintService {
  //SECTION: Method to create complain in app
  createNewComplainForApp = async (
    userId: string,
    hostelId: string,
    categoryId: string,
    subCategoryId: string,
    description: string,
    image: string,
    audio: string
  ): Promise<string> => {
    try {
      const leaveStartDate = new Date();
      leaveStartDate.setUTCHours(0, 0, 0, 0);

      const leaveEndDate = new Date();
      leaveEndDate.setUTCHours(23, 59, 59, 999);

      // Check if a student is in leave or not
      const existingLeave = await StudentLeave.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        $or: [
          {
            startDate: { $lte: leaveEndDate },
            endDate: { $gte: leaveStartDate },
          },
        ],
        leaveStatus: LeaveStatusTypes.APPROVED,
      });

      if (existingLeave) throw new Error(COMPLAIN_APPLY_ERROR);
      // Generate a new 7-digit ticketId
      const ticketId = await this.generateTicketId();

      //NOTE - get the category of the complaint
      const category = await ComplainCategory.findById(categoryId);
      if (!category) throw new Error(RECORD_NOT_FOUND("Category"));

      const { assignedStaffId } = await this.getRoundRobinStaffId(
        userId,
        categoryId,
        category.categoryType
      );

      // Create new complaint with an initial update log entry
      const newComplaint: any = await Complaint.create({
        ticketId,
        userId,
        hostelId,
        categoryType: category?.categoryType,
        categoryId,
        subCategoryId,
        description,
        image,
        audio,
        assignedStaff: assignedStaffId,
        createdBy: userId,
        updateLogs: [
          {
            assignedStaffId: assignedStaffId,
            complainStatus: ComplainStatusTypes.PENDING,
            date: getCurrentISTTime(),
            remark: "Complaint Created.",
            updatedBy: userId,
          },
        ],
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      if (newComplaint) {
        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await fetchPlayerNotificationConfig(
            userId,
            TemplateTypes.COMPLAINT_SUBMITTED
          );

        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await getStudentAllocatedHostelDetails(
            student?._id,
            student?.hostelId,
            TemplateTypes.COMPLAINT_SUBMITTED
          );

        //NOTE: Final notice created check.
        const finalNoticeCreated =
          isPlayedNoticeCreated && isHostelNoticeCreated;

        // NOTE: Combine available logs into an array
        const notificationLog = [log, hostelLogs].filter(Boolean);

        //NOTE: Retrieve complaint data for dynamic message.
        const { complaint } = await this.complaintDetailsById(
          newComplaint?._id
        );
        const dynamicData = {
          complaintType: complaint?.categoryType,
          complaintId: complaint?.ticketId,
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
            template?.image,
            TemplateTypes.COMPLAINT_SUBMITTED
          );
        }
      }
      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get all complaint
  async complaintByStatus(
    staffId: string,
    page: number,
    limit: number,
    status: ComplainStatusTypes,
    role: string,
    hostelId?: string,
    categoryId?: string,
    sort?: SortingTypes,
    startDate?: string,
    endDate?: string,
    search?: string,
    floorNumber?: string,
    roomNumber?: string
  ): Promise<{ complaint: any[]; count: number }> {
    try {
      const skip = (page - 1) * limit;
      let query: any = {};
      let searchUserParams: any = {};

      if (status !== ComplainStatusTypes.ALL) {
        query.complainStatus = status;
      }

      // Role-based filtering using switch-case
      switch (true) {
        case role === "super admin":
          // Super Admin: No additional filtering, fetch all complaints
          break;

        case /admin$/i.test(role) && hostelId !== undefined:
          // Matches any role ending with "admin" (e.g., "yoco admin", "admin"), case-insensitive
          query.hostelId = new mongoose.Types.ObjectId(hostelId);
          break;

        default:
          // Other roles: Filter by `assignedStaff = staffId`
          query.assignedStaff = new mongoose.Types.ObjectId(staffId);
      }

      if (categoryId) {
        query.categoryId = new mongoose.Types.ObjectId(categoryId);
      }

      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);

        query.createdAt = { $gte: start, $lte: end };
      }

      const sortOptions: any = {};
      switch (sort) {
        case SortingTypes.RECENT:
          sortOptions.createdAt = -1;
          break;
        case SortingTypes.OLDEST:
          sortOptions.createdAt = 1;
          break;
        default:
          sortOptions.createdAt = -1;
      }

      let userIds: mongoose.Types.ObjectId[] = [];

      if (floorNumber || roomNumber) {
        const allocationQuery: any = {};
        if (hostelId)
          allocationQuery.hostelId = new mongoose.Types.ObjectId(hostelId);
        if (floorNumber) allocationQuery.floorNumber = Number(floorNumber);
        if (roomNumber) allocationQuery.roomNumber = Number(roomNumber);

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
        searchUserParams.userId = {
          $in: userIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }
      query.hostelId = hostelId
      delete query.assignedStaff
      const [count, complaint] = await Promise.all([
        Complaint.countDocuments({ ...query, ...searchUserParams }),
        Complaint.find({ ...query, ...searchUserParams })
          .populate([
            { path: "userId", select: "name image uniqueId phone email" },
            { path: "hostelId", select: "name identifier" },
            { path: "categoryId", select: "name" },
            { path: "subCategoryId", select: "name" },
            { path: "assignedStaff", select: "name phone image userName" },
            { path: "updatedBy", select: "name" },
          ])
          .sort(sortOptions)
          .skip(skip)
          .limit(limit),
      ]);
     
      const response = await Promise.all(
        complaint.map(async (ele: any) => {
          const hostelDetails = await StudentHostelAllocation.findOne({
            studentId: ele?.userId?._id,
            hostelId: ele?.hostelId?._id,
            status: true,
          }).select("floorNumber roomNumber");

          const resolvedTimeFormatted =
            ele?.complainStatus === ComplainStatusTypes.RESOLVED &&
              ele?.resolvedTime
              ? (() => {
                const totalMinutes = ele.resolvedTime;
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                return hours > 0
                  ? `${hours} hr${hours > 1 ? "s" : ""} ${minutes} min${minutes > 1 ? "s" : ""
                  }`
                  : `${minutes} min${minutes > 1 ? "s" : ""}`;
              })()
              : null;

          return {
            _id: ele._id,
            ticketId: ele?.ticketId,
            complainStatus: ele?.complainStatus,
            categoryType: ele?.categoryType ?? null,
            userId: ele?.userId?._id,
            studentName: ele?.userId?.name ?? null,
            phone: ele?.userId?.phone ?? null,
            email: ele?.userId?.email ?? null,
            uniqueId: ele?.userId?.uniqueId ?? null,
            image: ele?.userId?.image
              ? await getSignedUrl(ele?.userId?.image)
              : null,
            hostelName: ele?.hostelId?.name ?? null,
            identifier: ele?.hostelId?.identifier ?? null,
            category: ele?.categoryId?.name ?? null,
            subCategory: ele?.subCategoryId?.name ?? null,
            floorNumber: hostelDetails?.floorNumber ?? null,
            roomNumber: hostelDetails?.roomNumber ?? null,
            assignedStaffId: ele?.assignedStaff?._id ?? null,
            assignedStaff: ele?.assignedStaff?.name ?? null,
            assignedStaffPhone: ele?.assignedStaff?.phone ?? null,
            assignedStaffUserName: ele?.assignedStaff?.userName ?? null,
            assignedStaffImage: ele?.assignedStaff?.image
              ? await getSignedUrl(ele?.assignedStaff?.image)
              : null,
            description: ele?.description ?? null,
            resolvedDate: ele?.resolvedDate ?? null,
            resolvedTime: resolvedTimeFormatted,
            escalationDate: ele?.escalationDate ?? null,
            escalationRemark: ele?.escalationRemark ?? null,
            createdAt: ele?.createdAt ?? null,
            cancelledDate: ele?.cancelledDate ?? null,
            updatedBy: ele?.updatedBy?.name ?? null,
          };
        })
      );

      if (sort === SortingTypes.ASCENDING) {
        response.sort((a, b) =>
          (a.studentName || "").localeCompare(b.studentName || "")
        );
      } else if (sort === SortingTypes.DESCENDING) {
        response.sort((a, b) =>
          (b.studentName || "").localeCompare(a.studentName || "")
        );
      }

      return { complaint: response, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to assign staff in case of escalation
  allocateStaffToComplaint = async (
    userId: string,
    staffId: string,
    complaintId: string,
    remark: string
  ): Promise<string> => {
    try {
      //NOTE - check the complain details
      const compaint = await Complaint.findById(complaintId);

      if (!compaint) throw new Error(RECORD_NOT_FOUND("Complaint"));

      if (
        compaint.complainStatus === ComplainStatusTypes.RESOLVED ||
        compaint.complainStatus === ComplainStatusTypes.CANCELLED
      )
        throw new Error(COMPLAINT_ALREADY_RESOLVED(compaint.complainStatus));

      //assign staff
      const complaintUpdate: any = await Complaint.findByIdAndUpdate(
        complaintId,
        {
          $set: {
            assignedStaff: staffId,
            updatedBy: userId,
            escalationDate: getCurrentISTTime(),
            escalationRemark: remark,
            assignDate: getCurrentISTTime(),
            updatedAt: getCurrentISTTime(),
          },
        }
      );
      if (complaintUpdate) {
        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await fetchPlayerNotificationConfig(
            userId,
            TemplateTypes.COMPLAINT_ESCALATED_ASSIGNED
          );

        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await getStudentAllocatedHostelDetails(
            student?._id,
            student?.hostelId,
            TemplateTypes.COMPLAINT_ESCALATED_ASSIGNED
          );

        //NOTE: Final notice created check.
        const finalNoticeCreated =
          isPlayedNoticeCreated && isHostelNoticeCreated;

        // NOTE: Combine available logs into an array
        const notificationLog = [log, hostelLogs].filter(Boolean);

        //NOTE: Get complaint details
        const { complaint } = await this.complaintDetailsById(
          complaintUpdate?._id
        );

        const dynamicData = {
          complaintType: complaint?.categoryType,
          complaintId: complaint?.ticketId,
          staffName: complaint?.assignedStaffName,
        };
console.log(template,"template")
        //NOTE: Add details for dynamic message using the populateTemplate.
        // const description = populateTemplate(
        //   template?.description,
        //   dynamicData
        // );

        // //NOTE: Create entry in notice
        // await Notice.create({
        //   userId: student?._id,
        //   hostelId: student?.hostelId,
        //   floorNumber: hostelDetail?.floorNumber,
        //   bedType: hostelDetail?.bedType,
        //   roomNumber: hostelDetail?.roomNumber,
        //   noticeTypes: NoticeTypes.PUSH_NOTIFICATION,
        //   pushNotificationTypes: PushNotificationTypes.AUTO,
        //   templateId: template?._id,
        //   templateSendMessage: description,
        //   isNoticeCreated: finalNoticeCreated,
        //   notificationLog,
        //   createdAt: getCurrentISTTime(),
        // });

        // //NOTE: Proceed to send push notification only when isNoticeCreated is true.
        // if (finalNoticeCreated) {
        //   //NOTE: Use the send push notification function.
        //   await sendPushNotificationToUser(
        //     playedIds,
        //     template?.title,
        //     description,
        //     template?.image,
        //     TemplateTypes.COMPLAINT_ESCALATED_ASSIGNED
        //   );
        // }
      }
      console.log(UPDATE_DATA,"UPDATEdaTA")
      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(`${error.message}`);
    }
  };

  //SECTION: Method to assign staff
  compaintStatusUpdate = async (
    userId: string,
    complainStatus: ComplainStatusTypes,
    remark: string,
    complaintId: string,
    attachments?: any[]
  ): Promise<string> => {
    try {
      // Check the complaint details
      const complaint: any = await Complaint.findById(complaintId);

      if (!complaint) throw new Error(RECORD_NOT_FOUND("Complaint"));

      if (
        complaint.complainStatus === ComplainStatusTypes.CANCELLED ||
        complaint.complainStatus === ComplainStatusTypes.RESOLVED ||
        complaint.complainStatus === ComplainStatusTypes.REJECTED
      )
        throw new Error(COMPLAINT_UPDATE_ERROR(complaint.complainStatus));

      if (complaint.assignedStaff === null) throw new Error(NO_ASSIGNED_STAFF);

      // Push the update log
      complaint.updateLogs.push({
        complainStatus, // the new status
        date: getCurrentISTTime(), // current date/time
        remark, // the provided remark
        attachments: attachments ?? [],
        updatedBy: new mongoose.Types.ObjectId(userId),
      });

      let resolvedTime: number = 0;

      // Check if the status is being set to RESOLVED
      if (complainStatus === ComplainStatusTypes.RESOLVED) {
        const createdAt = complaint?.createdAt; // Complaint creation time
        const resolvedDate = getCurrentISTTime(); // Current time as resolved date

        // Calculate the difference in milliseconds
        const timeDifference =
          resolvedDate.getTime() - new Date(createdAt).getTime();

        // Convert time difference from milliseconds to minutes
        resolvedTime = Math.floor(timeDifference / (1000 * 60)); // minutes
      }

      // Update the complaint with the new status and log
      const complaintUpdate: any = await Complaint.findByIdAndUpdate(
        complaintId,
        {
          $set: {
            complainStatus,
            updatedBy: userId,
            resolvedDate:
              complainStatus === ComplainStatusTypes.RESOLVED
                ? getCurrentISTTime()
                : null,
            resolvedTime,
            updatedAt: getCurrentISTTime(),
          },
          $push: {
            updateLogs: {
              assignedStaffId: complaint?.assignedStaff,
              complainStatus,
              date: getCurrentISTTime(),
              remark,
              attachments: attachments ?? [],
              updatedBy: userId,
            },
          },
        },
        { new: true } //NOTE: Optionally return the updated document
      );
      
      if (complaintUpdate) {
        //NOTE: Set the template type according to complain status
        const templateType =
          complainStatus === ComplainStatusTypes.RESOLVED
            ? TemplateTypes.COMPLAINT_RESOLVED
            : complainStatus === ComplainStatusTypes.ON_HOLD
              ? TemplateTypes.COMPLAINT_KEPT_ON_HOLD
              : complainStatus === ComplainStatusTypes.LONG_TERM_WORK
                ? TemplateTypes.COMPAINT_MARK_AS_LONG_TERM_WORK
                : TemplateTypes.COMPLAINT_REJECTED;

        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await fetchPlayerNotificationConfig(complaint?.userId, templateType);

        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await getStudentAllocatedHostelDetails(
            student?._id,
            student?.hostelId,
            templateType
          );

        //NOTE: Final notice created check.
        // const finalNoticeCreated =
        //   isPlayedNoticeCreated && isHostelNoticeCreated;

        // NOTE: Combine available logs into an array
        // const notificationLog = [log, hostelLogs].filter(Boolean);

        // //NOTE: Get complaint details
        // const result = await this.complaintDetailsById(complaintUpdate?._id);

        // const dynamicData = {
        //   complaintType: result?.complaint?.categoryType,
        //   complaintId: result?.complaint?.ticketId,
        //   reason: remark ? remark : null,
        // };

        //NOTE: Add details for dynamic message using the populateTemplate.
        // const description = populateTemplate(
        //   template?.description,
        //   dynamicData
        // );

        // //NOTE: Create entry in notice
        // await Notice.create({
        //   userId: student?._id,
        //   hostelId: student?.hostelId,
        //   floorNumber: hostelDetail?.floorNumber,
        //   bedType: hostelDetail?.bedType,
        //   roomNumber: hostelDetail?.roomNumber,
        //   noticeTypes: NoticeTypes.PUSH_NOTIFICATION,
        //   pushNotificationTypes: PushNotificationTypes.AUTO,
        //   templateId: template?._id,
        //   templateSendMessage: description,
        //   isNoticeCreated: finalNoticeCreated,
        //   notificationLog,
        //   createdAt: getCurrentISTTime(),
        // });
        // //NOTE: Proceed to send push notification only when isNoticeCreated is true.
        // if (finalNoticeCreated) {
        //   //NOTE: Use the send push notification function.
        //   await sendPushNotificationToUser(
        //     playedIds,
        //     template?.title,
        //     description,
        //     template?.image,
        //     templateType
        //   );
        // }
      }

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(`${error.message}`);
    }
  };

  //SECTION: Method to get all user complaint
  async userComplaintsByStatus(
    userId: string,
    status: ComplainStatusTypes
  ): Promise<{ complaints: any[] }> {
    try {
      // Define the base query object
      let query: any = { userId: new mongoose.Types.ObjectId(userId) };

      // Check the status and adjust the query accordingly
      if (status === ComplainStatusTypes.PENDING) {
        // Exclude resolved complaints when status is pending
        query.complainStatus = {
          $nin: [ComplainStatusTypes.RESOLVED, ComplainStatusTypes.CANCELLED],
        };
      } else if (status === ComplainStatusTypes.RESOLVED) {
        // Retrieve only resolved complaints
        query.complainStatus = ComplainStatusTypes.RESOLVED;
      }

      // Run the query to retrieve complaints
      const complaint = await Complaint.find(query)
        .populate([
          { path: "categoryId", select: "name" },
          { path: "subCategoryId", select: "name" },
        ])
        .sort({ createdAt: -1 });

      // Process the results to format the response
      const response = complaint.map((ele: any) => ({
        _id: ele._id,
        ticketId: ele.ticketId,
        userId: ele?.userId,
        complainStatus: ele?.complainStatus,
        description: ele?.description,
        category: ele?.categoryId?.name ?? null,
        subCategory: ele?.subCategoryId?.name ?? null,
        resolvedDate: ele?.resolvedDate ?? null,
        createdAt: ele?.createdAt ?? null,
      }));

      return { complaints: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get complaint Logs
  async complaintLogs(complaintId: string): Promise<{ logs: any[] }> {
    try {
      // Find the specific complaint by complaintId
      const complaint: any = await Complaint.findById(complaintId)
        .select("updateLogs")
        .populate("updateLogs.updatedBy", "name roleId")
        .populate("updateLogs.assignedStaffId", "name phone")
        .populate("assignedStaff", "name phone")
        .lean();

      if (!complaint) {
        throw new Error(RECORD_NOT_FOUND("Complaint"));
      }

      // Process the logs if they exist
      const logs = await Promise.all(
        (complaint.updateLogs || []).map(async (log: any) => {
          // Return early if the complainStatus is PENDING
          if (log.complainStatus === ComplainStatusTypes.PENDING) {
            return {
              _id: log._id,
              date: log.date,
              remark: log.remark || null,
              complainStatus: log.complainStatus,
              updatedBy: null,
            };
          }

          // Fetch role name if roleId exists
          const roleName = log.updatedBy?.roleId
            ? (await Role.findById(log.updatedBy.roleId).select("name").lean())
              ?.name || null
            : null;

          return {
            _id: log._id,
            date: log.date,
            remark: log.remark || null,
            complainStatus: log.complainStatus,
            assignedStaffName: log.assignedStaffId?.name,
            phone: log.assignedStaffId?.phone,
            updatedBy: {
              name: log.updatedBy?.name || null,
              roleName,
            },
          };
        })
      );

      return { logs };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method cancelled complaint by id
  async cancelComplaint(complaintId: string, userId: string): Promise<string> {
    try {
      // Find the specific complaint by complaintId
      const complaint = await Complaint.findOne({
        _id: new mongoose.Types.ObjectId(complaintId),
        userId: new mongoose.Types.ObjectId(userId),
      })
        .select("updateLogs complainStatus cancelledDate")
        .lean();

      if (!complaint) throw new Error(RECORD_NOT_FOUND("Complaint"));

      // Check if the complaint is already canceled
      if (
        complaint.complainStatus === ComplainStatusTypes.CANCELLED ||
        complaint.complainStatus === ComplainStatusTypes.RESOLVED
      )
        throw new Error(`Complaint is already ${complaint.complainStatus}.`);

      await Complaint.findByIdAndUpdate(
        complaintId,
        {
          complainStatus: ComplainStatusTypes.CANCELLED,
          cancelledDate: getCurrentISTTime(),
          $push: {
            updateLogs: {
              complainStatus: ComplainStatusTypes.CANCELLED,
              date: getCurrentISTTime(),
              remark: "Complaint canceled by user.",
              updatedBy: userId,
            },
          },
        },
        { new: true }
      );

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get complaint details by Id
  complaintDetailsById = async (
    complaintId: string
  ): Promise<{ complaint: any }> => {
    try {
      const complaint = await Complaint.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(complaintId) } },
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
            from: "complaincategories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "complainsubcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        { $unwind: { path: "$subCategory", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "staffs",
            localField: "assignedStaff",
            foreignField: "_id",
            as: "assignedStaffs",
          },
        },
        {
          $unwind: {
            path: "$assignedStaffs",
            preserveNullAndEmptyArrays: true,
          },
        },

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
        // Unwind updateLogs to work with each entry
        { $unwind: { path: "$updateLogs", preserveNullAndEmptyArrays: true } },
        // Lookup assignedStaff details inside updateLogs
        {
          $lookup: {
            from: "staffs",
            localField: "updateLogs.assignedStaffId",
            foreignField: "_id",
            as: "updateLogs.assignedStaffsDetails",
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
                  roomNumber: 1,
                  bedNumber: 1,
                  floorNumber: 1,
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
            categoryType: 1,
            uniqueId: "$user.uniqueId",
            name: "$user.name",
            email: "$user.email",
            phone: "$user.phone",
            userImage: "$user.image",
            academicYear: "$user.academicYear",
            bedType: "$hostelDetails.bedType",
            roomNumber: "$hostelDetails.roomNumber",
            floorNumber: "$hostelDetails.floorNumber",
            bedNumber: "$hostelDetails.bedNumber",
            hostelName: "$hostel.name",
            categoryName: "$category.name",
            subCategoryName: "$subCategory.name",
            description: 1,
            image: 1,
            audio: 1,
            assignedStaff: 1,
            assignedStaffName: "$assignedStaffs.name",
            assignedStaffImage: "$assignedStaffs.image",
            assignDate: 1,
            resolvedDate: 1,
            resolvedTime: 1,
            createdAt: 1,
            complainStatus: 1,
            // Keep the updateLogs structure but replace assignedStaffs with details
            "updateLogs.complainStatus": 1,
            "updateLogs.date": 1,
            "updateLogs.remark": 1,
            "updateLogs.attachments": 1,
            "updateLogs.assignedStaffs":
              "$updateLogs.assignedStaffsDetails.name",
          },
        },
        // Group back updateLogs
        {
          $group: {
            _id: "$_id",
            ticketId: { $first: "$ticketId" },
            categoryType: { $first: "$categoryType" },
            uniqueId: { $first: "$uniqueId" },
            name: { $first: "$name" },
            email: { $first: "$email" },
            phone: { $first: "$phone" },
            userImage: { $first: "$userImage" },
            academicYear: { $first: "$academicYear" },
            bedType: { $first: "$bedType" },
            roomNumber: { $first: "$roomNumber" },
            floorNumber: { $first: "$floorNumber" },
            bedNumber: { $first: "$bedNumber" },
            hostelName: { $first: "$hostelName" },
            categoryName: { $first: "$categoryName" },
            subCategoryName: { $first: "$subCategoryName" },
            description: { $first: "$description" },
            image: { $first: "$image" },
            audio: { $first: "$audio" },
            assignedStaff: { $first: "$assignedStaff" },
            assignedStaffName: { $first: "$assignedStaffName" },
            assignedStaffImage: { $first: "$assignedStaffImage" },
            assignDate: { $first: "$assignDate" },
            resolvedDate: { $first: "$resolvedDate" },
            resolvedTime: { $first: "$resolvedTime" },
            createdAt: { $first: "$createdAt" },
            complainStatus: { $first: "$complainStatus" },
            updateLogs: { $push: "$updateLogs" },
          },
        },
      ]);

      // Check if any complaint was found
      if (!complaint || complaint.length === 0)
        throw new Error(RECORD_NOT_FOUND("Complaint"));

      // Get the first complaint object
      const complaintData = complaint[0];

      // Transform the image and audio fields if they exist
      if (complaintData.image) {
        complaintData.image = await getSignedUrl(complaintData.image);
      }

      if (complaintData.audio) {
        complaintData.audio = await getSignedUrl(complaintData.audio);
      }

      // Transform the image and audio fields if they exist
      if (complaintData.userImage) {
        complaintData.userImage = await getSignedUrl(complaintData.userImage);
      }

      if (complaintData.assignedStaffImage) {
        complaintData.assignedStaffImage = await getSignedUrl(
          complaintData.assignedStaffImage
        );
      }

      if (complaintData?.updateLogs) {
        for (const data of complaintData.updateLogs) {
          if (data?.attachments) {
            for (const attachment of data.attachments) {
              attachment.url = await getSignedUrl(attachment?.url);
            }
          }
        }
      }

      // Check if the complaint is resolved and if there is resolvedTime
      if (
        complaintData?.complainStatus === ComplainStatusTypes.RESOLVED &&
        complaintData?.resolvedTime
      ) {
        const totalMinutes = complaintData.resolvedTime;

        // Calculate hours and minutes
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        // Format the resolvedTime string based on hours and minutes
        const formattedTime = [];
        if (hours > 0) {
          formattedTime.push(`${hours} hr${hours > 1 ? "s" : ""}`);
        }
        if (minutes > 0) {
          formattedTime.push(`${minutes} min${minutes > 1 ? "s" : ""}`);
        }

        // Join the formatted time parts
        complaintData.resolvedTime = formattedTime.join(" ");
      }

      // Fetch the next complaint ID
      const nextComplaint: any = await Complaint.findOne(
        {
          _id: { $gt: new mongoose.Types.ObjectId(complaintId) },
          complainStatus: complaintData.complainStatus,
        },
        { _id: 1 }
      ).sort({ _id: 1 });

      // Fetch the previous Complaint ID
      const previousComplaint: any = await Complaint.findOne(
        {
          _id: { $lt: new mongoose.Types.ObjectId(complaintId) },
          complainStatus: complaintData.complainStatus,
        },
        { _id: 1 }
      ).sort({ _id: -1 });

      return {
        complaint: {
          ...complaintData,
          nextComplaintId: nextComplaint?._id ?? null,
          previousComplaintId: previousComplaint?._id ?? null,
        },
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION - Method to get individual student complaints
  async individualStudentComplaints(
    hostelId: string,
    userId: string,
    page: number,
    limit: number,
    filter: ReportDropDownTypes,
    startDate: string,
    endDate: string
  ): Promise<{ complaints: any[]; count: number }> {
    try {
      let start: any | undefined, end: any | undefined;

      if (filter === ReportDropDownTypes.CUSTOM && startDate && endDate) {
        start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);

        end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
      } else {
        ({ start, end } = getDateRange(filter));
      }

      const dateFilter: any = {};
      if (start && end) {
        dateFilter.createdAt = { $gte: new Date(start), $lte: new Date(end) };
      }

      const skip = Math.max(page - 1, 0) * limit;

      const complaintsData = await Complaint.aggregate([
        {
          $match: {
            hostelId: new mongoose.Types.ObjectId(hostelId),
            userId: new mongoose.Types.ObjectId(userId),
            ...dateFilter,
          },
        },

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
            from: "complaincategories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "complainsubcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        { $unwind: { path: "$subCategory", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "staffs",
            localField: "assignedStaff",
            foreignField: "_id",
            as: "assignedStaffs",
          },
        },
        {
          $unwind: {
            path: "$assignedStaffs",
            preserveNullAndEmptyArrays: true,
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
                  roomNumber: 1,
                  bedNumber: 1,
                  floorNumber: 1,
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
            uniqueId: "$user.uniqueId",
            name: "$user.name",
            email: "$user.email",
            userImage: "$user.image",
            phone: "$user.phone",
            bedType: "$hostelDetails.bedType",
            roomNumber: "$hostelDetails.roomNumber",
            floorNumber: "$hostelDetails.floorNumber",
            bedNumber: "$hostelDetails.bedNumber",
            hostelName: "$hostel.name",
            categoryName: "$category.name",
            categoryType: 1,
            subCategoryName: "$subCategory.name",
            description: 1,
            image: 1,
            audio: 1,
            assignedStaff: 1,
            assignDate: 1,
            resolvedDate: 1,
            resolvedTime: 1,
            escalationDate: 1,
            escalationRemark: 1,
            createdAt: 1,
            complainStatus: 1,
          },
        },
        { $skip: skip },
        { $limit: limit },
      ]);

      // Count total documents for pagination metadata
      const count = await Complaint.countDocuments({
        hostelId: new mongoose.Types.ObjectId(hostelId),
        userId: new mongoose.Types.ObjectId(userId),
        ...dateFilter,
      });

      if (!complaintsData || complaintsData.length === 0) {
        return { complaints: [], count };
      }

      // Process each complaint
      for (const complaint of complaintsData) {
        if (complaint.image) {
          complaint.image = await getSignedUrl(complaint.image);
        }

        if (complaint.userImage) {
          complaint.userImage = await getSignedUrl(complaint.userImage);
        }

        if (complaint.audio) {
          complaint.audio = await getSignedUrl(complaint.audio);
        }

        // Format resolvedTime into days, hours, minutes, and seconds
        if (
          complaint?.complainStatus === ComplainStatusTypes.RESOLVED &&
          complaint?.resolvedTime
        ) {
          const totalSeconds = complaint.resolvedTime;
          const days = Math.floor(totalSeconds / 86400);
          const hours = Math.floor((totalSeconds % 86400) / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;

          const formattedTime = [];
          if (days > 0) {
            formattedTime.push(`${days} day${days > 1 ? "s" : ""}`);
          }
          if (hours > 0) {
            formattedTime.push(`${hours} hr${hours > 1 ? "s" : ""}`);
          }
          if (minutes > 0) {
            formattedTime.push(`${minutes} min${minutes > 1 ? "s" : ""}`);
          }
          if (seconds > 0) {
            formattedTime.push(`${seconds} sec${seconds > 1 ? "s" : ""}`);
          }

          complaint.resolvedTime = formattedTime.join(" ");
        }
      }

      return { complaints: complaintsData, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to bulk update complain status
  bulkUpdateComplainStatus = async (
    staffId: string,
    complaints: {
      complaintId: string;
      status: ComplainStatusTypes;
      remark: string;
    }[]
  ): Promise<string> => {
    try {
      // Fetch all complaints in a single query
      const complaintIds = complaints.map((c) => c.complaintId);
      const complaintRecords: any = await Complaint.find({
        _id: { $in: complaintIds },
      });

      if (complaintRecords.length !== complaints.length) {
        throw new Error(RECORD_NOT_FOUND("Complaints"));
      }

      // Check if any complaint has assignedStaff as null
      const unassignedComplaint = complaintRecords.find(
        (c: any) => c.assignedStaff === null
      );
      if (unassignedComplaint) throw new Error(NO_ASSIGNED_STAFF);

      const bulkOperations: any[] = complaints
        .map(({ complaintId, status, remark }) => {
          const complaint = complaintRecords.find(
            (c: any) => c._id.toString() === complaintId
          );
          if (!complaint) return null; // Ensuring that null values are handled

          const updatedBy = new mongoose.Types.ObjectId(staffId);
          const currentISTTime = getCurrentISTTime();
          let resolvedTime: number | null = null;

          if (status === ComplainStatusTypes.RESOLVED) {
            const createdAt = complaint.createdAt;
            resolvedTime = Math.floor(
              (currentISTTime.getTime() - new Date(createdAt).getTime()) /
              (1000 * 60)
            );
          }

          return {
            updateOne: {
              filter: { _id: new mongoose.Types.ObjectId(complaintId) },
              update: {
                $set: {
                  complainStatus: status,
                  updatedBy,
                  resolvedDate:
                    status === ComplainStatusTypes.RESOLVED
                      ? currentISTTime
                      : null,
                  resolvedTime,
                  updatedAt: currentISTTime,
                },
                $push: {
                  updateLogs: {
                    assignedStaffId: complaint.assignedStaff,
                    complainStatus: status,
                    date: currentISTTime,
                    remark,
                    updatedBy,
                  },
                },
              },
            },
          };
        })
        .filter(Boolean);
      if (bulkOperations.length === 0) {
        throw new Error("No valid complaints to update.");
      }

      await Complaint.bulkWrite(bulkOperations);

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(`Bulk update failed: ${error.message}`);
    }
  };

  //ANCHOR - generate Ticket Id
  generateTicketId = async (): Promise<string> => {
    // Get the latest ticketId from the database
    const latestComplaint = await Complaint.findOne({})
      .sort({ ticketId: -1 }) // Sort by ticketId in descending order
      .select("ticketId") // Only select the ticketId field
      .exec();

    if (latestComplaint && latestComplaint.ticketId) {
      // Increment the latest ticketId by 1
      const latestId = parseInt(latestComplaint.ticketId, 10);
      const newId = latestId + 1;

      // Return the new ticketId, formatted as a 7-digit string with leading zeros
      return String(newId).padStart(7, "0");
    } else {
      // If no ticketId exists, start with "0000001"
      return "0000001";
    }
  };

  //ANCHOR -  get Round Robin Staff Id
  getRoundRobinStaffId = async (
    userId: string,
    categoryId: string,
    categoryType: ComplaintTypes
  ): Promise<{ assignedStaffId: string | null }> => {
    try {
      // Get student room details
      const studentRoom = await StudentHostelAllocation.findOne({
        studentId: new mongoose.Types.ObjectId(userId),
      })
        .select("hostelId roomNumber floorNumber")
        .exec();

      if (!studentRoom) {
        return { assignedStaffId: null };
      }

      const hostelId = studentRoom.hostelId?.toString();
      const roomNumber = studentRoom.roomNumber;
      const floorNumber = studentRoom.floorNumber;

      if (!hostelId) {
        return { assignedStaffId: null };
      }

      // Get the last assigned complaint
      const lastComplaint: any = await Complaint.findOne({
        categoryId: new mongoose.Types.ObjectId(categoryId),
        categoryType,
      })
        .sort({ createdAt: -1 })
        .exec();

      // Get role IDs for the given category type
      const roleIds = await Role.find({ categoryType, status: true }).select(
        "_id"
      );

      // Get staff members who belong to the correct role and category
      let staffs: any = await Staff.find({
        roleId: { $in: roleIds.map((role) => role._id) },
        categoryId: new mongoose.Types.ObjectId(categoryId),
        status: true,
      }).sort({ createdAt: 1 });

      if (staffs.length === 0) return { assignedStaffId: null };

      // Filter staff based on hostelDetails
      staffs = staffs.filter((staff: any) =>
        staff.hostelDetails.some((detail: any) => {
          const staffHostelId = detail.hostelId?.toString();
          const staffFloorNumbers = Array.isArray(detail.floorNumber)
            ? detail.floorNumber
            : [];
          const staffRoomNumbers = Array.isArray(detail.roomNumber)
            ? detail.roomNumber
            : [];

          return (
            staffHostelId === hostelId &&
            (staffFloorNumbers.includes(floorNumber) ||
              staffRoomNumbers.includes(roomNumber))
          );
        })
      );

      if (staffs.length === 0) return { assignedStaffId: null };

      // Implement round-robin selection
      if (lastComplaint?.assignedStaff) {
        const lastAssignedIndex = staffs.findIndex(
          (staff: any) =>
            staff._id.toString() === lastComplaint.assignedStaff.toString()
        );

        const nextIndex =
          lastAssignedIndex !== -1
            ? (lastAssignedIndex + 1) % staffs.length
            : 0;
        return { assignedStaffId: staffs[nextIndex]._id.toString() };
      }

      return { assignedStaffId: staffs[0]._id.toString() };
    } catch (error: any) {
      throw new Error(`Failed to fetch round-robin staff: ${error.message}`);
    }
  };
}

export default new ComplaintService();
