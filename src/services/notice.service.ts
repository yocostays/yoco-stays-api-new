import mongoose from "mongoose";
import Hostel from "../models/hostel.model";
import Notice from "../models/notice.model";
import StudentHostelAllocation from "../models/studentHostelAllocation.model";
import Template from "../models/template.model";
import User from "../models/user.model";
import { getSignedUrl } from "../utils/awsUploadService";
import { sendPushNotificationToUser } from "../utils/commonService/pushNotificationService";
import {
  NoticeTypes,
  PushNotificationTypes,
  SortingTypes,
} from "../utils/enum";
import { getCurrentISTTime } from "../utils/lib";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "../utils/messages";

const { RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { CREATE_DATA } = SUCCESS_MESSAGES;

class NoticeService {
  //SECTION: Create new notice
  async createNotice(
    userIds: any[],
    noticeTypes: NoticeTypes,
    templateId: string,
  ): Promise<string> {
    try {
      //NOTE: Get template data if available.
      const templateData: any = await Template.findById(templateId);
      if (!templateData) throw new Error(RECORD_NOT_FOUND("Template"));

      if (templateData.image) {
        templateData.image = await getSignedUrl(templateData.image);
      }

      await Promise.all(
        userIds.map(async (userId) => {
          //NOTE: Get the student details if available.
          const studentDetails: any = await User.findById(userId);
          if (!studentDetails) {
            throw new Error(RECORD_NOT_FOUND("Student"));
          }

          //NOTE: Get the hostel details if available.
          const hostelCheck = await Hostel.findById(studentDetails?.hostelId);
          if (!hostelCheck) {
            throw new Error(RECORD_NOT_FOUND("Hostel"));
          }

          //NOTE: Get student allocated hostel details if available.
          const studentAllocatedHostelDetails: any =
            await StudentHostelAllocation.findOne({
              studentId: studentDetails?._id,
              hostelId: studentDetails?.hostelId,
            }).populate([{ path: "studentId", select: "name" }]);

          //NOTE: Played ids
          const playedIds: any[] = [
            studentDetails.oneSignalWebId,
            studentDetails.oneSignalAndoridId,
            studentDetails.oneSignalIosId,
          ].filter(Boolean);

          if (playedIds.length > 0) {
            //NOTE: Send push notification.
            await sendPushNotificationToUser(
              playedIds,
              templateData.title,
              templateData.description,
              templateData.templateType,
            );
          }

          //NOTE: Create Notice
          await Notice.create({
            userId: studentDetails?._id,
            hostelId: studentDetails?.hostelId,
            floorNumber: studentAllocatedHostelDetails?.floorNumber,
            bedType: studentAllocatedHostelDetails?.bedType,
            roomNumber: studentAllocatedHostelDetails?.roomNumber,
            noticeTypes,
            pushNotificationTypes: PushNotificationTypes.MANUAL,
            templateId: templateData?._id,
            createdAt: getCurrentISTTime(),
          });
        }),
      );

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Get all notice
  async getAllNotice(
    page: number,
    limit: number,
    search?: string,
    hostelId?: string,
    floorNumber?: number,
    roomNumber?: number,
    noticeType?: NoticeTypes,
    sort?: string,
  ): Promise<{ notices: any[]; count: number }> {
    try {
      const searchParams: any = {};
      let userIds: mongoose.Types.ObjectId[] = [];
      const sortOptions: any = {};

      // Calculate the number of documents to skip
      const skip = (page - 1) * limit;

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

      if (search && userIds.length) {
        searchParams.userId = { $in: userIds };
      }

      //NOTE: Hostel filter
      if (hostelId) {
        searchParams.hostelId = hostelId;
      }

      //NOTE: Notice type filter
      if (noticeType) {
        searchParams.noticeType = noticeType;
      }

      if (floorNumber) {
        searchParams.floor = floorNumber;
      }

      if (roomNumber) {
        searchParams.roomNumber = roomNumber;
      }

      //NOTE: Sort filter
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

      //NOTE: Find get all notice
      const data: any = await Notice.find(searchParams)
        .populate([
          { path: "userId", select: "name email phone" },
          { path: "hostelId", select: "name" },
        ])
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      const count = await Notice.countDocuments(searchParams).sort(sortOptions);

      const result = data.map((notice: any) => ({
        _id: notice?._id,
        userId: notice.userId?._id ?? null,
        userName: notice.userId?.name ?? null,
        userPhone: notice.userId?.phone ?? null,
        userEmail: notice.userId?.email ?? null,
        hostelId: notice.hostelId?._id ?? null,
        hostelName: notice.hostelId?.name ?? null,
        floorNumber: notice?.floorNumber ?? 0,
        bedType: notice?.bedType ?? 0,
        roomNumber: notice?.roomNumber ?? 0,
        noticeTypes: notice?.noticeTypes ?? 0,
        createdAt: notice?.createdAt ?? null,
      }));
      return { notices: result, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Get user notifications
  async getUserNotifications(
    userId: string,
  ): Promise<{ items: any[]; unreadCount: number }> {
    try {
      if (!mongoose.isValidObjectId(userId)) throw new Error("Invalid User ID");

      const notifications = await Notice.find({ userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      const unreadCount = await Notice.countDocuments({
        userId,
        isRead: false,
      });

      const items = notifications.map((notice: any) => ({
        id: notice._id,
        message: notice.templateSendMessage,
        isRead: notice.isRead,
        createdAt: notice.createdAt,
      }));

      return { items, unreadCount };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Mark all notifications as read for a user
  async markNotificationsAsRead(userId: string): Promise<void> {
    try {
      if (!mongoose.isValidObjectId(userId)) throw new Error("Invalid User ID");

      await Notice.updateMany(
        { userId, isRead: false },
        {
          isRead: true,
          readAt: getCurrentISTTime(),
        },
      );
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
}

export default new NoticeService();
