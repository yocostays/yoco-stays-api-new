import mongoose from "mongoose";
import User, { IUser } from "../models/user.model";
import Hostel from "../models/hostel.model";
import College from "../models/university.model";
import BulkUpload from "../models/bulkUpload.model";
import StudentHostelAllocation from "../models/studentHostelAllocation.model";
import StudentIndisciplinaryAction from "../models/studentIndisciplinaryAction.model";
import NotificationLog from "../models/notificationLog.model";
import Notice, { INotificationLog } from "../models/notice.model";
import RoleService from "../services/role.service";
import TemplateService from "../services/template.service";

import {
  createBillingCycleDetails,
  getCurrentISTTime,
  getDateRange,
  populateTemplate,
  removeHtmlTags,
} from "../utils/lib";
import {
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../utils/messages";
import { generateRandomPassword, hashPassword } from "../utils/hashUtils";
import { sendStudentWelcomeEmail } from "../services/mailService";

import {
  BedTypes,
  BillingCycleTypes,
  BloodGroupType,
  CategoryTypes,
  FetchUserTypes,
  Gender,
  NoticeTypes,
  PushNotificationTypes,
  ReportDropDownTypes,
  SortingTypes,
  TemplateTypes,
  UserGetByTypes,
  UserKycUploadTypes,
  VechicleTypes,
  VehicleEngineTypes,
} from "../utils/enum";
import { USER_FOLDER, USER_BULK_UPLOAD_FILES } from "../utils/s3bucketFolder";
import EmailQueue from "../models/emailQueue.model";
import {
  deleteFromS3,
  getSignedUrl,
  pushToS3Bucket,
  uploadFileInS3Bucket,
  uploadFileToCloudStorage,
} from "../utils/awsUploadService";
import Course from "../models/course.model";
import { sendPushNotificationToUser } from "../utils/commonService/pushNotificationService";
import moment from "moment";
import Joi from "joi";
import StudentLeave from "../models/student-leave.model";
import Complaint from "../models/complaint.model";
import BookMeals from "../models/bookMeal.model";
import { allowedDomains } from "../constants/allowedDomains";
import Token from "../models/token.model";

const { getRoleByName } = RoleService;
const { checkTemplateExist } = TemplateService;

const { ALREADY_EXIST_FIELD_ONE, ALREADY_EXIST_FIELD_TWO } =
  VALIDATION_MESSAGES;
const {
  UNIQUE_GENERATE_FAILED,
  RECORD_NOT_FOUND,
  IMAGE_UPLOAD_ERROR,
  INVALID_STATUS,
  TOTAL_CAPACITY_ISSUES,
  ONE_SIGNAL_PLAYERS_NOT_FOUND,
  NO_HOSTEL_FOR_THIS_STUDENT,
  ALLOCATE_HOSTEL_STUDENT_TO_ACTIVE,
  USER_STILL_ACTIVE,
} = ERROR_MESSAGES;
const { UPDATE_DATA, CREATE_DATA, FILE_UPLOADED, DELETE_DATA } =
  SUCCESS_MESSAGES;

const extractUploadPath = (url: string) => {
  if (!url) return null;

  if (url.includes("base64")) {
    return url;
  }
  // Check if the string is a full URL (production or localhost)
  const isFullUrl = url.startsWith("http://") || url.startsWith("https://");

  // If it's a URL AND contains uploads
  if (isFullUrl && url.includes("/uploads/")) {
    return url.split("/uploads/")[1]; // return part after uploads
  }

  // If not a URL (already a simple path)
  return url;
};
class UserService {
  //SECTION: Method to create a new student
  registerNewUser = async (
    name: string,
    email: string,
    phone: number,
    enrollmentNumber: string,
    dob: Date,
    fatherName: string,
    fatherNumber: number,
    motherName: string,
    motherNumber: number,
    adharNumber: number,
    bloodGroup: BloodGroupType,
    courseName: string,
    academicYear: number,
    guardianContactNo: number,
    category: string,
    hostelId: mongoose.Types.ObjectId,
    address: string,
    fatherEmail?: string,
    motherEmail?: string,
    semester?: number,
    oneSignalWebId?: string,
    oneSignalAndoridId?: string,
    oneSignalIosId?: string,
  ): Promise<IUser> => {
    try {
      // Step 1: Validate staff by email and phone
      await this.validateUser({ email, phone, enrollmentNumber });

      //NOTE - get role
      const { role } = await getRoleByName("student");

      const dobDate = new Date(dob);
      dobDate.setUTCHours(0, 0, 0, 0);

      // Step 3: Create the new user object
      const newUser = new User({
        name,
        email,
        phone,
        enrollmentNumber,
        dob: dobDate,
        fatherName,
        fatherNumber,
        motherName,
        motherNumber,
        adharNumber,
        bloodGroup,
        courseName,
        academicYear,
        guardianContactNo,
        category,
        hostelId,
        roleId: role._id,
        address,
        semester,
        oneSignalWebId,
        oneSignalAndoridId,
        oneSignalIosId,
        fatherEmail: fatherEmail ?? null,
        motherEmail: motherEmail ?? null,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      // Step 4: Save the new staff
      return await newUser.save();
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get a new student
  getStudentById = async (id: string): Promise<{ student: any }> => {
    try {
      // Fetch user details
      const student: any = await User.findById(id)
        .populate([
          { path: "academicDetails.universityId", select: "name" },
          { path: "academicDetails.courseId", select: "name" },
        ])
        .select("-password -createdBy -updatedBy -createdAt -updatedAt -__v")
        .lean();

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      // Ensure image is neither null nor undefined, and process it if present
      if (student?.image && student.image.trim() !== "") {
        student.image = await getSignedUrl(student.image);
      }

      // Process documents and convert to signed URLs if they exist
      const documents = student?.documents || {};

      student.documents = {
        aadhaarNumber: documents?.aadhaarNumber,
        aadhaarCard: documents?.aadhaarCard
          ? await getSignedUrl(documents?.aadhaarCard)
          : null,
        passport: documents?.passport
          ? await getSignedUrl(documents?.passport)
          : null,
        voterCard: documents?.voterCard
          ? await getSignedUrl(documents?.voterCard)
          : null,
        drivingLicense: documents?.drivingLicense
          ? await getSignedUrl(documents?.drivingLicense)
          : null,
        panCard: documents?.panCard
          ? await getSignedUrl(documents?.panCard)
          : null,
      };

      return { student };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get all user
  userWithPagination = async (
    page: number,
    limit: number,
    status: UserGetByTypes,
    search?: string,
    hostelId?: string,
    dateRange?: ReportDropDownTypes,
    sort?: SortingTypes,
    academicYear?: string,
  ): Promise<{
    students: any[];
    counts: {
      allUserCount: number;
      activeUserCount: number;
      inactiveUserCount: number;
      authorizedUserCount: number;
      leftCoverUserCount: number;
      userCount: number;
      newUserCount: number;
    };
  }> => {
    try {
      // Calculate the number of documents to skip
      const skip = (page - 1) * limit;

      // Check if search is a number
      const searchAsNumber = !isNaN(Number(search)) ? Number(search) : null;

      // Initialize search parameters
      let searchParams: any = {};

      // Set isVerified based on the status
      if (status === UserGetByTypes.ACTIVE) {
        searchParams.isVerified = true;
        searchParams.status = true;
      } else if (status === UserGetByTypes.INACTIVE) {
        searchParams.isVerified = true;
        searchParams.status = false;
      } else if (status === UserGetByTypes.ALL) {
        // Do nothing; this includes all verified and unverified users
      } else if (status === UserGetByTypes.AUTHORIZE) {
        searchParams.isAuthorized = true;
        // Do nothing; this includes all verified and unverified users
      } else if (status === UserGetByTypes.LEFT_USER) {
        // Do nothing; this includes all verified and unverified users
      } else if (status === UserGetByTypes.NEW) {
        // Get the current date and calculate the date 1 year ago
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        // Filter users created within the last year
        searchParams.createdAt = { $gte: oneYearAgo };
      } else {
        throw new Error(INVALID_STATUS);
      }

      // Build search parameters based on search input
      if (search) {
        searchParams.$or = [
          { name: { $regex: `^${search}`, $options: "i" } },
          { email: { $regex: `^${search}`, $options: "i" } },
          { uniqueId: { $regex: `^${search}`, $options: "i" } },
          ...(searchAsNumber ? [{ phone: searchAsNumber }] : []), // Add phone only if search is a valid number
        ];
      }

      // If hostelId is provided, include it in the query
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

      // Get date range from dateRange
      if (dateRange) {
        const { start, end } = getDateRange(dateRange);
        if (start && end) {
          searchParams.createdAt = {
            $gte: new Date(start),
            $lte: new Date(end),
          };
        }
      }

      //NOTE: If academic search.
      if (academicYear) {
        searchParams["academicDetails.academicYear"] = academicYear;
      }

      // Get the current date and calculate the date 1 year ago
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const sortOptions: any = {};
      switch (sort) {
        case SortingTypes.ASCENDING:
          sortOptions.name = 1; // A-Z
          break;
        case SortingTypes.DESCENDING:
          sortOptions.name = -1; // Z-A
          break;
        case SortingTypes.RECENT:
          sortOptions.createdAt = -1; // Recent
          break;
        case SortingTypes.OLDEST:
          sortOptions.createdAt = 1; // Oldest
          break;
        default:
          sortOptions.createdAt = -1; // Default to recent
      }

      // Run both queries in parallel to fetch counts and students
      const [
        allUserCount,
        activeUserCount,
        inactiveUserCount,
        authorizedUserCount,
        newUserCount,
        userCount,
        students,
      ] = await Promise.all([
        User.countDocuments({ ...searchHostel }),
        User.countDocuments({
          isVerified: true,
          ...searchHostel,
        }),
        User.countDocuments({
          isVerified: false,
          ...searchHostel,
        }),
        User.countDocuments({
          isAuthorized: true,
          ...searchHostel,
        }),
        User.countDocuments({
          createdAt: { $gte: oneYearAgo },
          ...searchHostel,
        }),
        User.countDocuments({ ...searchParams, ...searchHostel }),
        User.find({ ...searchParams, ...searchHostel })
          .populate([
            { path: "hostelId", select: "name" },
            { path: "createdBy", select: "name" },
          ])
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .select("-password"),
      ]);

      // Set default values for authorizedUserCount and leftCoverUserCount
      const leftCoverUserCount = 0; // Default value

      // Map the result to return necessary fields
      const result = await Promise.all(
        students.map(async (ele) => {
          // Fetch the room allocation for the student
          const room = await StudentHostelAllocation.findOne({
            studentId: ele._id,
            hostelId: ele.hostelId._id,
          })
            .select("joiningDate roomNumber floorNumber bedNumber")
            .sort({ createdAt: -1 })
            .lean();

          // Return the mapped object with necessary fields
          return {
            _id: ele._id,
            uniqueId: ele.uniqueId ?? null,
            name: ele.name ?? null,
            image: ele.image ? await getSignedUrl(ele.image) : null,
            email: ele.email ?? null,
            phone: ele.phone ?? null,
            joiningDate: room ? room?.joiningDate : null,
            gender: ele.gender ?? null,
            hostel: (ele?.hostelId as any)?.name ?? null,
            roomNumber: room ? room?.roomNumber : null,
            floorNumber: room ? room?.floorNumber : null,
            bedNumber: room ? room?.bedNumber : null,
            isVerified: ele?.isVerified,
            isAuthorized: ele?.isAuthorized,
            authorizRole: ele?.authorizRole ?? null,
            userStatus:
              ele?.status && ele?.isVerified
                ? "active"
                : ele?.status && !ele?.isVerified
                  ? "pending"
                  : "in-active",
            status: ele?.status,
            createdBy: (ele?.createdBy as any)?.name ?? null,
            createdAt: ele?.createdAt ?? null,
          };
        }),
      );

      // Return the results including counts
      return {
        students: status === UserGetByTypes.LEFT_USER ? [] : result,
        counts: {
          allUserCount,
          activeUserCount,
          inactiveUserCount,
          authorizedUserCount,
          leftCoverUserCount,
          userCount,
          newUserCount,
        },
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to retrieve Users Without Hostel
  retrieveUsersWithoutHostel = async (
    page: number,
    limit: number,
    search?: string,
    hostelId?: string,
  ): Promise<{ students: any[]; count: number }> => {
    try {
      // Calculate the number of documents to skip
      const skip = (page - 1) * limit;

      // Check if search is a number
      const searchAsNumber = !isNaN(Number(search)) ? Number(search) : null;

      // Initialize search parameters
      const searchParams: any = {
        isVerified: false, // Always include isVerified filter
      };

      // Build search parameters based on search input
      if (search) {
        searchParams.$or = [
          { name: { $regex: `^${search}`, $options: "i" } },
          { email: { $regex: `^${search}`, $options: "i" } },
          ...(searchAsNumber ? [{ phone: searchAsNumber }] : []), // Add phone only if search is a valid number
        ];
      }

      // If hostelId is provided, include it in the query
      if (hostelId) {
        searchParams.hostelId = { $exists: false }; // Ensure users without a hostel
      }

      // Run both queries in parallel
      const [count, students] = await Promise.all([
        User.countDocuments(searchParams),
        User.find(searchParams)
          .populate([
            { path: "hostelId", select: "name" },
            { path: "createdBy", select: "name" },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select("-password"),
      ]);

      // Map the result to return necessary fields
      const result = students.map((ele) => ({
        _id: ele._id,
        name: ele.name ?? null,
        email: ele.email ?? null,
        phone: ele.phone ?? null,
        gender: ele.gender ?? null,
        hostel: (ele.hostelId as any)?.name ?? null,
        status: ele?.status,
        createdBy: (ele?.createdBy as any)?.name ?? null,
        createdAt: ele?.createdAt ?? null,
      }));

      return { students: result, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to assign Hostel to Indivisual User
  assignHostelIndivisualUser = async (
    hostelId: mongoose.Types.ObjectId,
    studentId: mongoose.Types.ObjectId,
    bedType: BedTypes,
    roomNumber: number,
    bedNumber: string,
    billingCycle: BillingCycleTypes,
    staffId: mongoose.Types.ObjectId,
  ): Promise<string> => {
    try {
      const currentDate = new Date();
      currentDate.setUTCHours(0, 0, 0, 0);

      //NOTE - get student details
      const user = await User.findById(studentId);

      if (!user) throw new Error(RECORD_NOT_FOUND("User"));

      // Get hostel details
      const [hostel] = await Hostel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(hostelId) } },
        {
          $project: {
            _id: 1,
            identifier: 1,
            securityFee: 1,
            bedDetails: {
              $filter: {
                input: "$bedDetails",
                as: "bedDetail",
                cond: { $eq: ["$$bedDetail.bedType", bedType] },
              },
            },
            roomDetails: {
              $filter: {
                input: "$roomMapping",
                as: "room",
                cond: { $eq: ["$$room.roomNumber", roomNumber] },
              },
            },
          },
        },
      ]);

      if (!hostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      const uniqueId = await this.generateUniqueYocoId(
        hostel?.identifier,
        hostel?._id,
      );

      // Step 2: Hash the password
      // const hashedPassword = await hashPassword("123456789");
      const plainPassword = generateRandomPassword(8);
      const hashedPassword = await hashPassword(plainPassword);
      // console.log("password", plainPassword, hashedPassword);

      // Generate billingCycleDetails based on the billing cycle type
      const billingDetails = createBillingCycleDetails(
        hostel.bedDetails[0]?.accommodationFee,
        billingCycle,
      );

      // Assuming you have the required imports and context setup
      if (user?.hostelId.toString() !== hostelId.toString()) {
        // Update existing StudentHostelAllocation
        await StudentHostelAllocation.findOneAndUpdate(
          { studentId, status: true }, // Find the existing allocation for the student
          {
            hostelId,
            bedType: 4,
            roomNumber,
            bedNumber,
            securityFee: hostel?.securityFee,
            floorNumber: hostel.roomDetails[0]?.floorNumber,
            billingCycle,
            billingCycleDetails: billingDetails,
            updatedAt: getCurrentISTTime(), // Update the timestamp
            updatedBy: staffId,
          },
          { new: true }, // Return the updated document
        );

        // Update the student table
        await User.findByIdAndUpdate(studentId, {
          $set: {
            isVerified: true,
            verifiedBy: staffId,
            hostelId,
            uniqueId,
            password: hashedPassword,
            updatedBy: staffId,
            updatedAt: getCurrentISTTime(),
          },
        });
      } else {
        // Assign hostel to the user
        await StudentHostelAllocation.create({
          studentId,
          hostelId,
          bedType,
          roomNumber,
          bedNumber,
          securityFee: hostel?.securityFee,
          floorNumber: hostel.roomDetails[0]?.floorNumber,
          billingCycle,
          billingCycleDetails: billingDetails,
          joiningDate: currentDate,
          createdBy: staffId,
          createdAt: getCurrentISTTime(),
          updatedAt: getCurrentISTTime(),
        });

        // Update the student table
        await User.findByIdAndUpdate(studentId, {
          $set: {
            isVerified: true,
            verifiedBy: staffId,
            hostelId,
            uniqueId,
            password: hashedPassword,
            updatedBy: staffId,
            updatedAt: getCurrentISTTime(),
          },
        });
      }

      //NOTE - update the hostel bed mapping
      await Hostel.findOneAndUpdate(
        { _id: hostelId, "roomMapping.roomNumber": roomNumber },
        {
          $inc: {
            "roomMapping.$.vacant": -1,
            "roomMapping.$.occupied": 1,
          },
          $set: {
            "roomMapping.$.bedNumbers.$[bed].isVacant": false,
          },
        },
        {
          new: true,
          runValidators: true,
          arrayFilters: [{ "bed._id": bedNumber }],
          upsert: true,
        },
      );

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to update student in app
  updateStudentInApp = async (
    studentId: mongoose.Types.ObjectId,
    // image: string,
    studentData: any,
  ): Promise<string> => {
    try {
      const studentExists: any = await User.findById(studentId);
      if (!studentExists) throw new Error(RECORD_NOT_FOUND("User"));

      if (studentExists?.email !== studentData?.email) {
        const student = await User.findOne({ email: studentData?.email });
        if (student) {
          throw new Error("Email already exist");
        }
      }

      // Check if the email is already in use by another user
      // const checkUser: any = await User.findOne({
      //   _id: { $ne: studentId },
      //   email: studentData?.email
      // });
      // if (checkUser) throw new Error(ALREADY_EXIST_FIELD_ONE("Email"));
      // const currentUser = await User.findById(studentId);

      // Get the current user to check if there is an existing image
      // let payload: { email: string; image?: string } = { email };
      let payload: any = {};
      const data = extractUploadPath(studentData?.image);
      if (data && data.includes("base64")) {
        const uploadImage = await uploadFileInS3Bucket(data, USER_FOLDER);
        if (uploadImage !== false) {
          payload = { image: uploadImage.Key };
        } else {
          throw new Error(IMAGE_UPLOAD_ERROR);
        }
      } else {
        payload.image = data || null;
      }

      const safeData = { ...studentData };
      delete safeData.email;
      delete safeData.phone;
      delete safeData.image;

      // Merge safe fields
      payload = { ...payload, ...safeData };

      // Update the user's email and image in the database
      const update = await User.findByIdAndUpdate(
        studentId,
        { $set: payload },
        { new: true },
      );

      //NOTE: Send profile update notification using new template system
      if (update) {
        try {
          const { playedIds, template, student, isPlayedNoticeCreated, log } =
            await this.fetchPlayerNotificationConfig(
              studentId.toString(),
              TemplateTypes.PROFILE_UPDATED,
            );

          //NOTE: Get student and hostelDetails
          const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
            await this.getStudentAllocatedHostelDetails(
              student?._id,
              student?.hostelId,
              TemplateTypes.PROFILE_UPDATED,
            );

          // Relaxed condition: Send push if we have player IDs, even if template is missing
          const finalNoticeCreated =
            (isPlayedNoticeCreated && isHostelNoticeCreated) ||
            (playedIds && playedIds.length > 0);

          // NOTE: Combine available logs into an array
          const notificationLog = [log, hostelLogs].filter(Boolean);

          const description =
            template?.description ||
            "Your profile details have been updated successfully.";

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

          //NOTE: Send push notification if we have player IDs (relaxed condition)
          if (playedIds && playedIds.length > 0) {
            await sendPushNotificationToUser(
              playedIds,
              template?.title || "profile updated",
              description,
              TemplateTypes.PROFILE_UPDATED,
            );
          } else {
            console.warn(
              "[ProfileUpdate] Push skipped - No player IDs found for student:",
              studentId.toString(),
            );
          }
        } catch (notifyErr: any) {
          // Log error but don't fail the entire update operation
          console.error(
            `[ProfileUpdate Notification Failed] StudentId: ${studentId.toString()}, Error: ${notifyErr.message}`,
          );
        }
      }
      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get student in app
  fetchStudentInfoById = async (
    studentId: mongoose.Types.ObjectId,
  ): Promise<{ response: any }> => {
    try {
      // Check if the student exists
      const studentExists = await User.exists({ _id: studentId });
      if (!studentExists) throw new Error(RECORD_NOT_FOUND("User"));

      // Fetch the student's information
      const checkUser: any = await User.findOne({
        _id: studentId,
      }).select(
        "uniqueId name email roomNumber floorNumber permanentAddress category phone bulkCountry gender medicalIssue identificationMark bulkState bulkCity image hostelId vechicleDetails indisciplinaryAction familiyDetails bloodGroup dob documents academicDetails",
      );
      // Fetch the room details for the student
      const studentRoomDetails = await StudentHostelAllocation.findOne({
        studentId: studentId,
        hostelId: checkUser.hostelId,
      })
        .select("roomNumber floorNumber")
        .sort({ createdAt: -1 })
        .lean();

      if (!studentRoomDetails || !studentRoomDetails.roomNumber) {
        throw new Error("Room details not found for this student");
      }

      // Get roommates in the same hostel and room
      const roomMates = await User.find({
        hostelId: checkUser.hostelId,
        _id: { $ne: checkUser._id },
        uniqueId: { $ne: null },
        isVerified: true,
      }).select("name email phone image hostelId");

      const roomMatesData = await Promise.all(
        roomMates.map(async (data: any) => {
          const details = await StudentHostelAllocation.findOne({
            studentId: data._id,
            hostelId: data.hostelId,
            roomNumber: studentRoomDetails?.roomNumber,
            floorNumber: studentRoomDetails?.floorNumber,
          })
            .select("roomNumber bedNumber")
            .sort({ createdAt: -1 })
            .lean();

          if (details?.roomNumber === studentRoomDetails?.roomNumber) {
            return {
              _id: data._id,
              name: data.name ?? null,
              email: data.email ?? null,
              phone: data.phone ?? null,
              image: data.image ? await getSignedUrl(data.image) : null,
              roomDetails: details
                ? `${details.roomNumber ?? null}/${details?.bedNumber ?? null}`
                : null,
            };
          }
          return null;
        }),
      );
      const filteredRoomMatesData = roomMatesData.filter(Boolean);
      // Fetch indisciplinary actions if they exist
      let indisciplinaryActions = null;
      if (checkUser.indisciplinaryAction) {
        indisciplinaryActions = await StudentIndisciplinaryAction.find({
          studentId: checkUser._id,
        }).select("staffId remark isFine fineAmount createdAt");
      }

      // Prepare the response
      const response = {
        _id: checkUser._id,
        address: checkUser?.permanentAddress ?? null,
        name: checkUser?.name ?? null,
        gender: checkUser?.gender ?? null,
        uniqueId: checkUser?.uniqueId ?? null,
        country: checkUser?.bulkCountry ?? null,
        state: checkUser?.bulkState ?? null,
        city: checkUser?.bulkCity ?? null,
        email: checkUser?.email ?? null,
        phone: checkUser?.phone ?? null,
        image: checkUser?.image ? await getSignedUrl(checkUser?.image) : null,
        bloodGroup: checkUser?.bloodGroup ?? null,
        dob: checkUser?.dob ?? null,
        category: checkUser?.category ?? null,
        semester: checkUser?.academicDetails?.semester ?? null,
        fatherName: checkUser?.familiyDetails?.fatherName ?? null,
        fatherNumber: checkUser?.familiyDetails?.fatherNumber ?? null,
        motherName: checkUser?.familiyDetails?.motherName ?? null,
        motherNumber: checkUser?.familiyDetails?.motherNumber ?? null,
        fatherEmail: checkUser?.familiyDetails?.fatherEmail ?? null,
        motherEmail: checkUser?.familiyDetails?.motherEmail ?? null,
        guardianName: checkUser?.familiyDetails?.guardianName ?? null,
        guardianRelationship: checkUser?.familiyDetails?.relationship ?? null,
        guardianOccuption: checkUser?.familiyDetails?.occuption ?? null,
        guardianAddress: checkUser?.familiyDetails?.address,
        isVechicleDetailsAdded: checkUser?.vechicleDetails.length > 0,
        vechicleDetails: checkUser?.vechicleDetails ?? null,
        isKycDocumentAdded: !!checkUser?.documents,
        identificationMark: checkUser?.identificationMark,
        medicalIssue: checkUser?.medicalIssue,
        documents: {
          aadhaarNumber: checkUser?.documents?.aadhaarNumber,
          aadhaarCard: checkUser?.documents?.aadhaarCard
            ? await getSignedUrl(checkUser?.documents?.aadhaarCard)
            : null,
          passport: checkUser?.documents?.passport
            ? await getSignedUrl(checkUser?.documents?.passport)
            : null,
          voterCard: checkUser?.documents?.voterCard
            ? await getSignedUrl(checkUser?.documents?.voterCard)
            : null,
          drivingLicense: checkUser?.documents?.drivingLicense
            ? await getSignedUrl(checkUser?.documents?.drivingLicense)
            : null,
          panCard: checkUser?.documents?.panCard
            ? await getSignedUrl(checkUser?.documents?.panCard)
            : null,
        },
        roomMatesData: filteredRoomMatesData,
        indisciplinaryActions: indisciplinaryActions ?? [], // Send the actions if available
      };

      return { response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to update student vechicle details in app
  modifyVehicleInApp = async (
    studentId: string,
    vehicleDetails: any[],
  ): Promise<string> => {
    try {
      // Check if the student exists
      const studentExists = await User.exists({ _id: studentId });

      if (!studentExists) throw new Error(RECORD_NOT_FOUND("User"));

      // Update vehicleDetails in bulk
      const update = await User.findByIdAndUpdate(
        studentId,
        {
          $set: {
            vechicleDetails: vehicleDetails.map((vehicle) => ({
              vechicleType: vehicle.vechicleType,
              engineType: vehicle.engineType || VehicleEngineTypes.NOT_REQUIRED,
              vechicleNumber: vehicle.vechicleNumber ?? null,
              modelName: vehicle.modelName,
            })),
          },
        },
        { new: true },
      );

      //NOTE: Send vehicle sync notification using new template system
      if (update) {
        try {
          const { playedIds, template, student, isPlayedNoticeCreated, log } =
            await this.fetchPlayerNotificationConfig(
              studentId.toString(),
              TemplateTypes.VEHICLE_UPDATED,
            );

          //NOTE: Get student and hostelDetails
          const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
            await this.getStudentAllocatedHostelDetails(
              student?._id,
              student?.hostelId,
              TemplateTypes.VEHICLE_UPDATED,
            );

          // Relaxed condition: Send push if we have player IDs, even if template is missing
          const finalNoticeCreated =
            (isPlayedNoticeCreated && isHostelNoticeCreated) ||
            (playedIds && playedIds.length > 0);

          // NOTE: Combine available logs into an array
          const notificationLog = [log, hostelLogs].filter(Boolean);

          const description =
            template?.description ||
            "Your vehicle details have been updated successfully.";

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

          //NOTE: Send push notification if we have player IDs (relaxed condition)
          if (playedIds && playedIds.length > 0) {
            await sendPushNotificationToUser(
              playedIds,
              template?.title || "Vehicle Update",
              description,
              TemplateTypes.VEHICLE_UPDATED,
            );
          } else {
            console.warn(
              "[VehicleSync] Push skipped - No player IDs found for student:",
              studentId.toString(),
            );
          }
        } catch (notifyErr: any) {
          // Log error but don't fail the entire vehicle update operation
          console.error(
            `[VehicleSync Notification Failed] StudentId: ${studentId.toString()}, Error: ${notifyErr.message}`,
          );
        }
      }

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get a student by uniqueId
  getStudentByUniqueId = async (
    uniqueId: string,
  ): Promise<{ student: any }> => {
    try {
      // Run both queries in parallel
      const student = await User.findOne({ uniqueId })
        .lean()
        .select("-password -createdBy -updatedBy");

      return { student };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to upload Document
  uploadDocument = async (
    user: any,
    type: UserKycUploadTypes,
    file?: any,
    staffId?: string,
  ): Promise<{ fileType: UserKycUploadTypes; url: any }> => {
    try {
      const existingUrl = user?.documents && user?.documents[type];

      // Initialize the documents field if it doesn't exist
      if (!user.documents) {
        user.documents = {}; // Initialize as an empty object if it's null or undefined
      }

      let url;
      if (file) {
        // Upload the new file to cloud storage and get the response
        const uploadResponse = await uploadFileToCloudStorage(
          file,
          USER_FOLDER,
        );

        // Extract the URL (Location) from the response
        url = uploadResponse && uploadResponse.Key ? uploadResponse?.Key : null;

        if (!url) throw new Error(IMAGE_UPLOAD_ERROR);

        // Update the documents object with the new URL
        await User.findByIdAndUpdate(user._id, {
          $set: { [`documents.${type}`]: url, updatedBy: staffId },
        });

        // If there's an existing URL, delete the old file from S3
        if (existingUrl) {
          await deleteFromS3(
            process.env.S3_BUCKET_NAME ?? "yoco-staging",
            existingUrl,
          );
        }

        //NOTE: Send KYC upload notification using new template system
        try {
          const { playedIds, template, student, isPlayedNoticeCreated, log } =
            await this.fetchPlayerNotificationConfig(
              user._id.toString(),
              TemplateTypes.DOCUMENT_UPLOADED,
            );

          //NOTE: Get student and hostelDetails
          const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
            await this.getStudentAllocatedHostelDetails(
              student?._id,
              student?.hostelId,
              TemplateTypes.DOCUMENT_UPLOADED,
            );

          // Relaxed condition: Send push if we have player IDs, even if template is missing
          const finalNoticeCreated =
            (isPlayedNoticeCreated && isHostelNoticeCreated) ||
            (playedIds && playedIds.length > 0);

          // NOTE: Combine available logs into an array
          const notificationLog = [log, hostelLogs].filter(Boolean);

          const description =
            template?.description ||
            "Your document has been uploaded successfully.";

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

          //NOTE: Send push notification if we have player IDs (relaxed condition)
          if (playedIds && playedIds.length > 0) {
            await sendPushNotificationToUser(
              playedIds,
              template?.title || "Document Upload",
              description,
              TemplateTypes.DOCUMENT_UPLOADED,
            );
          } else {
            console.warn(
              "[KYCUpload] Push skipped - No player IDs found for student:",
              user._id.toString(),
            );
          }
        } catch (notifyErr: any) {
          // Log error but don't fail the entire upload operation
          console.error(
            `[KYCUpload Notification Failed] StudentId: ${user._id.toString()}, Error: ${notifyErr.message}`,
          );
        }
      } else {
        if (existingUrl) {
          // Delete the existing file from S3 if it exists
          await deleteFromS3(
            process.env.S3_BUCKET_NAME ?? "yoco-staging",
            existingUrl,
          );
        }

        // Update the documents object to set the type key to null
        await User.findByIdAndUpdate(user._id, {
          $set: { [`documents.${type}`]: null, updatedBy: staffId },
        });
      }

      const updatedUrl = url ? await getSignedUrl(url) : null;

      return { fileType: type, url: updatedUrl };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get student in warden or admin panel
  studentDetailsByType = async (
    studentId: mongoose.Types.ObjectId,
    type: FetchUserTypes,
  ): Promise<{ details: any }> => {
    try {
      // Check if the student exists
      const studentExists = await User.exists({ _id: studentId });
      if (!studentExists) throw new Error(RECORD_NOT_FOUND("User"));

      // Fetch user details
      const checkUser: any = await User.findById(studentId)
        .populate([
          { path: "hostelId", select: "name roomMapping" },
          { path: "roleId", select: "name" },
          { path: "academicDetails.universityId", select: "name" },
          { path: "academicDetails.courseId", select: "name" },
        ])
        .lean();

      if (!checkUser) throw new Error(RECORD_NOT_FOUND("Student"));

      // Fetch hostel allocation details
      const userHostelDetails = await StudentHostelAllocation.findOne({
        studentId: checkUser._id,
        hostelId: checkUser.hostelId._id,
      })
        .select(
          "buildingNumber bedType roomNumber bedNumber floorNumber joiningDate billingCycle",
        )
        .sort({ createdAt: -1 })
        .lean();

      const baseResponse = {
        _id: checkUser._id,
        status: checkUser?.status,
        isLeft: checkUser?.isLeft,
        leftDate: checkUser?.leftDate,
      };

      let response;

      switch (type) {
        case FetchUserTypes.PERSONAL:
          response = {
            ...baseResponse,
            name: checkUser?.name ?? null,
            uniqueId: checkUser?.uniqueId ?? null,
            email: checkUser?.email ?? null,
            phone: checkUser?.phone ?? null,
            image: checkUser?.image
              ? await getSignedUrl(checkUser.image)
              : null,
            dob: checkUser?.dob ?? null,
            enrollmentNumber: checkUser?.enrollmentNumber ?? null,
            bloodGroup: checkUser?.bloodGroup ?? null,
            divyang: checkUser?.divyang ?? null,
            gender: checkUser?.gender ?? null,
            identificationMark: checkUser?.identificationMark ?? null,
            medicalIssue: checkUser?.medicalIssue ?? null,
            allergyProblem: checkUser?.allergyProblem ?? null,
            country: checkUser?.country ?? null,
            state: checkUser?.state ?? null,
            city: checkUser?.city ?? null,
            category: checkUser?.category ?? null,
            cast: checkUser?.cast ?? null,
            permanentAddress: checkUser?.permanentAddress ?? null,
            currentAddress: checkUser?.currentAddress ?? null,
          };
          break;
        case FetchUserTypes.HOSTEL:
          // Get roommates in the same hostel and room
          const roomMates = await StudentHostelAllocation.find({
            studentId: { $ne: checkUser._id },
            hostelId: checkUser.hostelId?._id,
            roomNumber: userHostelDetails?.roomNumber,
            floorNumber: userHostelDetails?.floorNumber,
          }).select("studentId roomNumber bedNumber billingCycle");

          // Extract studentIds to batch fetch users
          const studentIds = roomMates.map((mate: any) => mate.studentId);
          // Fetch user details in one query
          const users = await User.find({
            _id: { $in: studentIds },
            uniqueId: { $ne: null },
            isVerified: true,
          }).select("name email phone image");

          const roomMatesData = await Promise.all(
            roomMates.map(async (mate: any) => {
              const user = users.find(
                (u: any) => u._id.toString() === mate.studentId.toString(),
              );

              if (user) {
                return {
                  _id: user._id,
                  name: user.name ?? null,
                  email: user.email ?? null,
                  phone: user.phone ?? null,
                  image: user.image ? await getSignedUrl(user.image) : null,
                  roomDetails: `${mate.roomNumber ?? null}/${
                    mate.bedNumber ?? null
                  }`,
                };
              }

              return null;
            }),
          );
          // Remove null values from roomMatesData
          const filteredRoomMatesData = roomMatesData.filter(Boolean);
          response = {
            ...baseResponse,
            hostelId: checkUser?.hostelId._id ?? null,
            hostelName: checkUser?.hostelId?.name ?? null,
            buildingNumber: userHostelDetails?.buildingNumber,
            joiningDate: userHostelDetails?.joiningDate,
            bedType: userHostelDetails?.bedType,
            roomNumber: userHostelDetails?.roomNumber,
            bedNumber: userHostelDetails?.bedNumber,
            floorNumber: userHostelDetails?.floorNumber,
            billingCycle: userHostelDetails?.billingCycle,
            roomMatesData: filteredRoomMatesData,
          };
          break;
        case FetchUserTypes.FAMILY:
          response = {
            ...baseResponse,
            fatherName: checkUser?.familiyDetails?.fatherName ?? null,
            fatherNumber: checkUser?.familiyDetails?.fatherNumber ?? null,
            fatherEmail: checkUser?.familiyDetails?.fatherEmail ?? null,
            fatherOccuption: checkUser?.familiyDetails?.fatherOccuption ?? null,
            motherName: checkUser?.familiyDetails?.motherName ?? null,
            motherNumber: checkUser?.familiyDetails?.motherNumber ?? null,
            motherEmail: checkUser?.familiyDetails?.motherEmail ?? null,
            guardianName: checkUser?.familiyDetails?.guardianName ?? null,
            guardianContactNo:
              checkUser?.familiyDetails?.guardianContactNo ?? null,
            relationship: checkUser?.familiyDetails?.relationship ?? null,
            occuption: checkUser?.familiyDetails?.occuption ?? null,
            guardianEmail: checkUser?.familiyDetails?.guardianEmail ?? null,
            address: checkUser?.familiyDetails?.address ?? null,
          };
          break;
        case FetchUserTypes.KYC:
          response = {
            ...baseResponse,
            documents: {
              aadhaarCard: checkUser?.documents?.aadhaarCard
                ? await getSignedUrl(checkUser.documents.aadhaarCard)
                : null,
              passport: checkUser?.documents?.passport
                ? await getSignedUrl(checkUser.documents.passport)
                : null,
              voterCard: checkUser?.documents?.voterCard
                ? await getSignedUrl(checkUser.documents.voterCard)
                : null,
              drivingLicense: checkUser?.documents?.drivingLicense
                ? await getSignedUrl(checkUser.documents.drivingLicense)
                : null,
              panCard: checkUser?.documents?.panCard
                ? await getSignedUrl(checkUser.documents.panCard)
                : null,
            },
          };
          break;

        case FetchUserTypes.VEHICLE:
          response = {
            ...baseResponse,
            vechicleDetails: checkUser?.vechicleDetails ?? null,
          };
          break;

        case FetchUserTypes.INDISCIPLINARY:
          const indisciplinaryActions = await StudentIndisciplinaryAction.find({
            studentId: checkUser._id,
          }).select("staffId remark isFine fineAmount createdAt");
          response = { ...baseResponse, indisciplinaryActions };
          break;
        case FetchUserTypes.ACADEMIC:
          response = {
            ...baseResponse,
            universityId: checkUser?.academicDetails?.universityId ?? null,
            courseId: checkUser?.academicDetails?.courseId ?? null,
            academicYear: checkUser?.academicDetails?.academicYear ?? null,
            semester: checkUser?.academicDetails?.semester ?? null,
          };
          break;

        default:
          throw new Error(`Invalid user type: ${type}`);
      }

      return { details: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to update Authorized User
  updateAuthorizedUser = async (
    studentId: string,
    isAuthorized: boolean,
    authorizRole: string,
    staffId: string,
  ): Promise<string> => {
    try {
      //update Authorized User
      const userUpdate: any = await User.findByIdAndUpdate(
        studentId,
        {
          $set: {
            isAuthorized,
            authorizRole,
            updatedBy: staffId,
            updatedAt: getCurrentISTTime(),
          },
        },
        { new: true },
      );

      //NOTE: Check user leave applied or not.
      if (userUpdate) {
        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await this.fetchPlayerNotificationConfig(
            userUpdate?._id,
            TemplateTypes.USER_ROLE_UPDATED,
          );
        let description: any = {};

        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await this.getStudentAllocatedHostelDetails(
            studentId,
            student?.hostelId,
          );

        //NOTE: Final notice created check.
        const finalNoticeCreated =
          isPlayedNoticeCreated && isHostelNoticeCreated;

        // NOTE: Combine available logs into an array
        const notificationLog = [log, hostelLogs].filter(Boolean);

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

        //NOTE:  Proceed to send push notification only when isNoticeCreated is true.
        if (finalNoticeCreated) {
          const dynamicData = {
            userName: userUpdate?.name,
            newRole: userUpdate?.authorizRole,
          };
          description = populateTemplate(template?.description, dynamicData);

          //NOTE: Use the send push notification function.
          await sendPushNotificationToUser(
            playedIds,
            template?.title,
            description,
            TemplateTypes.USER_ROLE_UPDATED,
          );
        }
      }

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to create a new user from warden panel
  createUserFromWardenPanel = async (
    name: string,
    phone: number,
    email: string,
    dob: Date,
    enrollmentNumber: string,
    bloodGroup: BloodGroupType,
    divyang: boolean,
    gender: Gender,
    identificationMark: string,
    medicalIssue: string,
    allergyProblem: string,
    country: any,
    state: any,
    city: any,
    category: CategoryTypes,
    cast: string,
    permanentAddress: string,
    currentAddress: string,
    familiyDetails: {
      fatherName: string;
      // fatherNumber: number;
      // fatherEmail?: string;
      // fatherOccuption?: string;
      motherName?: string;
      // motherNumber?: number;
      // motherEmail?: string;
      guardianName?: string;
      // guardianContactNo?: number;
      relationship?: string;
      occuption?: string;
      // parentEmail
      guardianEmail?: string;
      parentsContactNo?: number;
      address?: string;
    },
    academicDetails: {
      universityId: mongoose.Types.ObjectId;
      courseId: mongoose.Types.ObjectId;
      academicYear: string;
      semester: number;
    },
    documents: {
      aadhaarNumber?: string;
      aadhaarCard?: string;
      voterCard?: string;
      passport?: string;
      drivingLicense?: string;
      panCard?: string;
    },
    hostelId: mongoose.Types.ObjectId,
    bedType: BedTypes,
    buildingNumber: string,
    floorNumber: number,
    roomNumber: number,
    bedNumber: string,
    billingCycle: BillingCycleTypes,
    vechicleDetails: any[],
    staffId: string,
    image?: string,
  ): Promise<{ uniqueId: string }> => {
    try {
      //NOTE - get university capacity

      if (academicDetails.universityId) {
        const university = await College.findById(
          academicDetails?.universityId,
        );

        if (!university) throw new Error(RECORD_NOT_FOUND("University"));
      }
      // Get the user count for the current university
      // const userCount = await User.countDocuments({
      //   "academicDetails.universityId": university._id,
      // });

      // if (userCount >= university.totalCapacity)
      //   throw new Error(TOTAL_CAPACITY_ISSUES);

      const currentDate = new Date();
      currentDate.setUTCHours(0, 0, 0, 0);

      if (enrollmentNumber) {
        // Step 1: Validate staff by email and phone
        await this.validateUser({ email, phone, enrollmentNumber });
      }

      //NOTE - get role
      const { role } = await getRoleByName("student");

      const dobDate = new Date(dob);
      dobDate.setUTCHours(0, 0, 0, 0);

      // Get hostel details
      const [hostel] = await Hostel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(hostelId) } },
        {
          $project: {
            _id: 1,
            identifier: 1,
            securityFee: 1,
            bedDetails: {
              $filter: {
                input: "$bedDetails",
                as: "bedDetail",
                cond: { $eq: ["$$bedDetail.bedType", bedType] },
              },
            },
            roomDetails: {
              $filter: {
                input: "$roomMapping",
                as: "room",
                cond: { $eq: ["$$room.roomNumber", roomNumber] },
              },
            },
          },
        },
      ]);
      if (!hostel) throw new Error(RECORD_NOT_FOUND("Hostel"));

      const uniqueId = await this.generateUniqueYocoId(
        hostel?.identifier,
        hostel?._id,
      );

      // Step 2: Hash the password
      const hashedPassword = await hashPassword("123456789");

      // Generate billingCycleDetails based on the billing cycle type
      // const billingDetails = createBillingCycleDetails(
      //   hostel.bedDetails[0]?.accommodationFee,
      //   billingCycle
      // );

      // Step 3: Handle image upload if exists
      if (image && image.includes("base64")) {
        const uploadImage = await uploadFileInS3Bucket(image, USER_FOLDER);
        if (uploadImage !== false) {
          image = uploadImage.Key;
        } else {
          throw new Error(IMAGE_UPLOAD_ERROR);
        }
      }

      // Step 4: Handle document uploads, set null if no document
      const uploadedDocuments: any = {};
      for (const [key, value] of Object.entries(documents)) {
        if (value && value.includes("base64")) {
          const uploadDoc = await uploadFileInS3Bucket(value, USER_FOLDER);
          if (uploadDoc !== false) {
            uploadedDocuments[key] = uploadDoc.Key;
          } else {
            uploadedDocuments[key] = null; // Set to null if upload fails
          }
        } else {
          uploadedDocuments[key] = null; // If no document provided, set as null
        }
      }

      // Step 5: Create the new user object
      const newUser = await User.create({
        roleId: role._id,
        uniqueId,
        name,
        image,
        password: hashedPassword,
        email,
        phone,
        enrollmentNumber,
        dob: dobDate,
        bloodGroup,
        divyang,
        gender,
        identificationMark,
        medicalIssue,
        allergyProblem,
        country,
        state,
        city,
        category,
        cast,
        permanentAddress,
        currentAddress,
        familiyDetails,
        academicDetails,
        documents: uploadedDocuments,
        hostelId,
        vechicleDetails,
        isVerified: true,
        verifiedBy: staffId,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
        createdBy: staffId,
      });

      // Step 6: Student Hostel Allocation
      await StudentHostelAllocation.create({
        studentId: newUser._id,
        hostelId,
        buildingNumber,
        bedType,
        roomNumber,
        bedNumber,
        floorNumber,
        securityFee: hostel?.securityFee,
        billingCycle,
        // billingCycleDetails: billingDetails,
        joiningDate: currentDate,
        createdBy: staffId,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      // Step 7: Update the hostel bed mapping
      //     const host =  await Hostel.findOneAndUpdate(
      //         { _id: hostelId, "roomMapping.roomNumber": roomNumber },
      //         {
      //           $inc: {
      //             "roomMapping.$.vacant": -1,
      //             "roomMapping.$.occupied": 1,
      //           },
      //           $set: {
      //             "roomMapping.$.bedNumbers.$[bed].isVacant": false,
      //           },
      //         },
      //         {
      //           new: true,
      //           runValidators: true,
      //           arrayFilters: [{ "bed._id": bedNumber }],
      //           upsert: true,
      //         }
      //       );
      await Hostel.findOneAndUpdate(
        { _id: hostelId, "roomMapping.roomNumber": roomNumber },
        {
          $inc: {
            "roomMapping.$.vacant": -1,
            "roomMapping.$.occupied": 1,
          },
          $set: {
            "roomMapping.$.bedNumbers.$[bed].isVacant": false,
          },
        },
        {
          new: true,
          runValidators: true,
          arrayFilters: [{ "bed.bedNumber": bedNumber }],
        },
      );

      return { uniqueId: newUser.uniqueId };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to upload indisciplinary Action Update
  studentIndisciplinaryAction = async (
    studentId: string,
    remark: string,
    isFine: boolean,
    fineAmount: number,
    staffId?: string,
  ): Promise<string> => {
    try {
      //NOTE - Check student
      const student = await User.exists({ _id: studentId });

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      //NOTE - update student
      await User.findByIdAndUpdate(studentId, {
        $set: { indisciplinaryAction: true },
      });

      //NOTE - create indisciplinary action for student
      await StudentIndisciplinaryAction.create({
        studentId,
        staffId,
        remark,
        isFine,
        fineAmount,
        createdBy: staffId,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });
      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //here we do user bulk upload  and send welcome mail with id and password
  userBulkUpload = async (
    jsonData: any[],
    staffId: string,
    hostelId: string,
    universityId: string,
    url?: any,
  ) => {
    let successArray: any[] = [];
    let errorArray: any[] = [];

    try {
      // const validGenders = ["male", "female", "other", "not selected"];
      // Schema Validation
      const schema = Joi.object({
        Gender: Joi.string().required().messages({
          "any.required": "Gender is required",
        }),
        Email: Joi.string()
          .trim()
          .email({ tlds: { allow: false } })
          .custom((value, helpers) => {
            const domain = value.split("@")[1]?.trim();

            if (!allowedDomains.includes(domain)) {
              return helpers.error("any.invalid");
            }
            return value;
          })
          .required()
          .messages({
            "string.email": "Invalid email format",
            "any.invalid": `Only these domains allowed: ${allowedDomains.join(
              ", ",
            )}`,
            "any.required": "Email is required",
          }),
        "Date of Birth": Joi.date().required().messages({
          "any.required": "Date of Birth is required",
          "date.base": "Invalid Date format for Date of Birth",
        }),
        "Full Name of Student": Joi.string().max(70).required().messages({
          "string.max": "Full Name must not exceed 70 characters",
          "any.required": "Full Name is required",
        }),
        "Mobile No.": Joi.string()
          .trim()
          .custom((value, helpers) => {
            if (!/^\d+$/.test(value)) {
              return helpers.error("any.invalid");
            }
            if (value.length < 8 || value.length > 15) {
              return helpers.error("number.length");
            }
            return value;
          })
          .required()
          .messages({
            "any.invalid": "Mobile Number must contain digits only",
            "number.length": "Mobile Number must be between 8 to 15 digits",
            "any.required": "Mobile Number is required",
          }),
        "Father's Name": Joi.string().max(70).required().messages({
          "string.max": "Full Name must not exceed 70 characters",
          "any.required": "Full Name is required",
        }),
        "Mother's Name": Joi.string().max(70).required().messages({
          "string.max": "Full Name must not exceed 70 characters",
          "any.required": "Full Name is required",
        }),
        "Permanent Address": Joi.string().required(),
        "Hostel Name": Joi.string().required(),
        "Aadhaar Number": Joi.number()
          .allow("", null) // allow empty
          .integer()
          .required()
          .custom((value, helpers) => {
            const str = String(value);

            // Must be only digits
            if (!/^\d+$/.test(str)) {
              return helpers.error("any.invalid");
            }

            // Check length 8 to 18 digits
            if (str.length !== 12) {
              return helpers.error("number.length");
            }

            return value;
          })
          .messages({
            "any.invalid": "Aadhaar Number must contain digits only",
            "number.length": "Aadhaar Number must be exactly 12 digits",
            // "any.required": "Aadhaar Number is required",
            "number.base": "Aadhaar Number must be a number",
          }),
        Country: Joi.string().required(),
        State: Joi.string().required(),
        City: Joi.string().required(),
        "Mother's Mobile No.": Joi.number()
          .integer()
          .required()
          .custom((value, helpers) => {
            const str = String(value);

            // Must be only digits
            if (!/^\d+$/.test(str)) {
              return helpers.error("any.invalid");
            }

            // Check length 8 to 18 digits
            if (str.length < 8 || str.length > 15) {
              return helpers.error("number.length");
            }

            return value;
          })
          .messages({
            "any.invalid": "Mother's Mobile No. must contain digits only",
            "number.length":
              "Mother's Mobile No. must be between 8 to 15 digits",
            "any.required": "Mother's Mobile No. is required",
            "number.base": "Mother's Mobile No. must be a number",
          }),
        "Father's Mobile No.": Joi.number()
          .integer()
          .required()
          .custom((value, helpers) => {
            const str = String(value);

            // Must be only digits
            if (!/^\d+$/.test(str)) {
              return helpers.error("any.invalid");
            }

            // Check length 8 to 18 digits
            if (str.length < 8 || str.length > 15) {
              return helpers.error("number.length");
            }

            return value;
          })
          .messages({
            "any.invalid": "Father's Mobile No. must contain digits only",
            "number.length":
              "Father's Mobile No. must be between 8 to 15 digits",
            "any.required": "Father's Mobile No. is required",
            "number.base": "Father's Mobile No. must be a number",
          }),
        "Room Number": Joi.number().integer().required(),
        "Floor Number": Joi.number().integer().required(),
        "Blood Group": Joi.string().required(),
        "Bed Number": Joi.string().required(),
      });

      // Validate and classify entries
      for (const item of jsonData) {
        let errors: string[] = [];
        const { error, value } = schema.validate(item, {
          abortEarly: false, // collect all errors
        });

        if (error) {
          error.details.forEach((err: any) => {
            const field = err.context.label || err.context.key;
            const message = err.message.replace(/"/g, "");
            errors.push(`${field}: ${message}`);
          });
        }
        if (value?.["Date of Birth"]?.success === false) {
          item["Date of Birth"] = value["Date of Birth"]?.date;
        }
        const phoneStr = value?.["Mobile No."];
        // Check for duplicate phone
        if (phoneStr && /^[0-9]+$/.test(phoneStr)) {
          const phoneNum = Number(phoneStr);
          const phoneExists = await User.findOne({
            phone: phoneNum,
          });
          if (phoneExists) {
            errors.push(`Mobile No. of Student: Phone number already exists`);
          }
        }

        // Check for duplicate Aadhaar
        if (value?.Email) {
          const emailExist = await User.findOne({
            email: value?.Email,
          });
          if (emailExist) {
            errors.push(`Email: Email already exists`);
          }
        }

        // Check for duplicate Aadhaar
        if (value?.["Aadhaar Number"]) {
          const aadhaarExists = await User.findOne({
            "documents.aadhaarNumber": String(value["Aadhaar Number"]),
          });
          if (aadhaarExists) {
            errors.push(`Aadhaar Number: Aadhaar number already exists`);
          }
        }

        const dob = value["Date of Birth"];

        if (moment(dob).isAfter(moment(), "day")) {
          errors.push("Invalid DOB: Date cannot be in the future.");
        }

        if (errors.length > 0) {
          errorArray.push({ ...item, errors: errors.join(" | ") });
        } else {
          successArray.push({ ...item });
        }
      }

      // Check university capacity
      const university = await College.findById(universityId);
      if (!university) throw new Error(RECORD_NOT_FOUND("University"));

      const userCount = await User.countDocuments({
        "academicDetails.universityId": university._id,
      });

      if (userCount >= university.totalCapacity)
        throw new Error(TOTAL_CAPACITY_ISSUES);

      const currentDate = new Date();
      currentDate.setUTCHours(0, 0, 0, 0);

      const { role } = await getRoleByName("student");

      // Create Bulk Upload Entry
      let bulkUpload;
      try {
        bulkUpload = await BulkUpload.create({
          originalFile: url,
          createdBy: staffId,
          createdAt: getCurrentISTTime(),
          updatedAt: getCurrentISTTime(),
        });
      } catch (er) {
        throw new Error("Failed to create bulk upload entry.");
      }

      // const welcomeMailQueue: {
      //   email: string;
      //   name: string;
      //   uniqueId: string;
      //   plainPassword: string;
      // }[] = [];

      // console.log("welcomqueue", welcomeMailQueue);
      // console.log("successArray", successArray);

      // Process valid entries
      for (let i = 0; i < successArray.length; i++) {
        const data = successArray[i];

        try {
          const {
            "Full Name of Student": name,
            // "Mobile Number of Student": phone,
            "Mobile No.": phone,
            Gender: gender,
            Country: nationality,
            State: state,
            City: city,
            "Date of Birth": dobExcel,
            "Permanent Address": permanentAddress,
            "Father's Name": fatherName,
            "Father's Mobile No.": fatherNumber,
            "Mother's Name": motherName,
            "Mother's Mobile No.": motherNumber,
            "Aadhaar Number": aadharNumber,
            "Room Number": roomNumber,
            "Floor Number": floorNumber,
            "Bed Number": bedNumber,
            "Blood Group": bloodGroup,
            email: Email,
          } = data;

          let uniqueId;
          // Get hostel info
          const [hostel] = await Hostel.aggregate([
            {
              $match: { _id: new mongoose.Types.ObjectId(hostelId) },
            },
            {
              $project: {
                _id: 1,
                buildingNumber: 1,
                identifier: 1,
                securityFee: 1,
                roomDetails: {
                  $filter: {
                    input: "$roomMapping",
                    as: "room",
                    cond: {
                      $and: [
                        { $eq: ["$$room.floorNumber", floorNumber] },
                        { $eq: ["$$room.roomNumber", roomNumber] },
                        {
                          $gt: [
                            {
                              $size: {
                                $filter: {
                                  input: "$$room.bedNumbers",
                                  as: "bed",
                                  cond: {
                                    $and: [
                                      { $eq: ["$$bed.bedNumber", bedNumber] },
                                      { $eq: ["$$bed.isVacant", true] }, //  only vacant beds
                                    ],
                                  },
                                },
                              },
                            },
                            0,
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
            { $unwind: "$roomDetails" },
            {
              $project: {
                _id: 1,
                buildingNumber: 1,
                identifier: 1,
                securityFee: 1,
                roomDetails: {
                  floorNumber: 1,
                  roomNumber: 1,
                  bedType: 1,
                  bedNumbers: {
                    $filter: {
                      input: "$roomDetails.bedNumbers",
                      as: "bed",
                      cond: {
                        $and: [
                          { $eq: ["$$bed.bedNumber", bedNumber] },
                          { $eq: ["$$bed.isVacant", true] }, // only return vacant bed
                        ],
                      },
                    },
                  },
                },
              },
            },
          ]);

          if (!hostel) {
            errorArray.push({ ...data, errors: "Bed already occupied" });
            continue; // skip to next student, don't touch successArray
          } else {
            uniqueId = await this.generateUniqueYocoId(
              hostel?.identifier,
              hostel?._id,
            );

            const plainPassword = generateRandomPassword(8);
            const hashedPassword = await hashPassword(plainPassword);

            // console.log("password");

            const newUser = new User({
              roleId: role._id,
              uniqueId,
              permanentAddress,
              bloodGroup,
              email: data?.Email,
              documents: {
                aadhaarNumber: aadharNumber,
              },
              name: name.toUpperCase(),
              password: hashedPassword,
              phone,
              dob: dobExcel,
              gender,
              bulkCountry: nationality.trim(),
              bulkState: state.trim(),
              bulkCity: city.trim(),
              familiyDetails: {
                fatherName,
                // parentsContactNo,
                motherName,
                motherNumber,
                fatherNumber,
              },
              hostelId: hostel?._id,
              isVerified: true,
              verifiedBy: staffId,
              createdAt: getCurrentISTTime(),
              updatedAt: getCurrentISTTime(),
              createdBy: staffId,
            });

            await newUser.save();

            // Queue email only after successful save
            if (data?.Email) {
              await EmailQueue.create({
                email: data.Email,
                name,
                uniqueId,
                plainPassword,
                status: "pending",
              });
            }
            await Hostel.findOneAndUpdate(
              {
                _id: new mongoose.Types.ObjectId(hostelId),
                "roomMapping.floorNumber": floorNumber,
                "roomMapping.roomNumber": roomNumber,
                "roomMapping.bedNumbers": {
                  $elemMatch: { bedNumber: String(bedNumber), isVacant: true },
                },
              },
              {
                $set: {
                  "roomMapping.$[room].bedNumbers.$[bed].isVacant": false,
                },
                $inc: {
                  "roomMapping.$[room].vacant": -1,
                  "roomMapping.$[room].occupied": 1,
                },
              },
              {
                arrayFilters: [
                  {
                    "room.floorNumber": floorNumber,
                    "room.roomNumber": roomNumber,
                  },
                  { "bed.bedNumber": String(bedNumber) },
                ],
                new: true,
              },
            );

            await StudentHostelAllocation.create({
              studentId: newUser._id,
              hostelId: hostel._id,
              buildingNumber: hostel?.buildingNumber,
              roomNumber,
              bedType: hostel.roomDetails?.bedType,
              bedNumber: hostel.roomDetails?.bedNumbers[0]?.bedNumber,
              floorNumber: hostel.roomDetails?.floorNumber,
              securityFee: hostel?.securityFee,
              joiningDate: currentDate,
              createdBy: staffId,
              createdAt: getCurrentISTTime(),
              updatedAt: getCurrentISTTime(),
            });
          }
        } catch (error: any) {
          errorArray.push({ ...data, errors: error.message });
        }
      }

      try {
        let successFileUrl: string | null = null;
        let errorFileUrl: string | null = null;

        if (successArray.length > 0) {
          successFileUrl = await pushToS3Bucket(
            successArray,
            process.env.S3_BUCKET_NAME!,
            USER_BULK_UPLOAD_FILES,
          );
        }

        if (errorArray.length > 0) {
          errorFileUrl = await pushToS3Bucket(
            errorArray,
            process.env.S3_BUCKET_NAME!,
            USER_BULK_UPLOAD_FILES,
          );
        }

        // if (bulkUpload?._id && (successFileUrl || errorFileUrl)) {
        await BulkUpload.findByIdAndUpdate(bulkUpload._id, {
          $set: {
            ...(successFileUrl && { successFile: successFileUrl }),
            ...(errorFileUrl && { errorFile: errorFileUrl }),
            updatedAt: getCurrentISTTime(),
            createdAt: getCurrentISTTime(),
          },
        });
        // } else {
        //   console.warn("⚠️ No file URLs generated or _id missing — skipping update");
        // }
      } catch (err) {
        console.error("🚨 Error during file generation/upload:", err);
      }
      /** ------------------ SAVE RESULT FILES ------------------ */

      return FILE_UPLOADED;
    } catch (error: any) {
      console.log(error, "errrooooooo");
      throw new Error(`${error.message}`);
    }
  };

  //SECTION: Method to delete user Vehicle details
  deleteVehicle = async (
    vehicleId: string,
    userId: string,
  ): Promise<string> => {
    try {
      const result = await User.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(userId) },
        {
          $pull: {
            vechicleDetails: { _id: new mongoose.Types.ObjectId(vehicleId) },
          },
        },
        { new: true },
      );

      if (!result) throw new Error(RECORD_NOT_FOUND("Vehicle"));

      return DELETE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to update a user from warden panel
  updateUserFromWardenPanel = async (
    studentId: string,
    name: string,
    phone: number,
    email: string,
    dob: Date,
    enrollmentNumber: string,
    bloodGroup: BloodGroupType,
    divyang: boolean,
    gender: Gender,
    identificationMark: string,
    medicalIssue: string,
    allergyProblem: string,
    country: any,
    state: any,
    city: any,
    category: CategoryTypes,
    cast: string,
    permanentAddress: string,
    // currentAddress: string,
    familiyDetails: {
      fatherName: string;
      fatherNumber: number;
      fatherEmail?: string;
      fatherOccuption?: string;
      motherName?: string;
      motherNumber?: number;
      motherEmail?: string;
      guardianName?: string;
      guardianContactNo?: number;
      relationship?: string;
      occuption?: string;
      guardianEmail?: string;
      address?: string;
    },
    academicDetails: {
      universityId: mongoose.Types.ObjectId;
      courseId: mongoose.Types.ObjectId;
      academicYear: string;
      semester: number;
    },
    documents: {
      aadhaarCard?: string;
      voterCard?: string;
      passport?: string;
      drivingLicense?: string;
      panCard?: string;
    },
    vechicleDetails: {
      vechicleType?: VechicleTypes;
      engineType?: VehicleEngineTypes;
      vechicleNumber?: string;
      modelName?: string;
    },
    staffId: string,
    image?: string,
    floorNumber?: number,
    roomNumber?: number,
    bedNumber?: string,
    aadharNumber?: string,
    hostelId?: string,
  ): Promise<string> => {
    try {
      // Step 1: Validate and fetch existing student
      const student = await User.findById(studentId).lean();
      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      if (String(student?.email) !== String(email)) {
        const student = await User.findOne({ email });
        if (student) {
          throw new Error("Email already exist");
        }
      }

      if (Number(student?.phone) !== Number(phone)) {
        const student = await User.findOne({ phone });
        if (student) {
          throw new Error("Phone already exist");
        }
      }
      // Step 2: Validate university
      if (academicDetails.universityId) {
        const university = await College.findById(
          academicDetails?.universityId,
        );

        if (!university) throw new Error(RECORD_NOT_FOUND("University"));
      }

      if (enrollmentNumber) {
        // Step 3: Validate staff details
        await this.validateUser({ email, phone, enrollmentNumber, studentId });
      }

      const dobDate = new Date(dob);
      dobDate.setUTCHours(0, 0, 0, 0);

      const currentDate = new Date();
      currentDate.setUTCHours(0, 0, 0, 0);

      // Step 4: Handle image update
      if (image && image.includes("base64")) {
        const uploadImage = await uploadFileInS3Bucket(image, USER_FOLDER);
        if (uploadImage !== false) {
          image = uploadImage.Key;
        } else {
          throw new Error(IMAGE_UPLOAD_ERROR);
        }
      } else {
        image = student.image; // Retain the existing image key if no new image is provided
      }

      // Step 5: Handle document updates
      let updatedDocuments: any = { ...documents };
      for (const [key, value] of Object.entries(documents)) {
        const extracted = extractUploadPath(value);

        // 1️⃣ If NOT base64 → use extracted URL/path directly
        if (extracted && !extracted.includes("base64")) {
          updatedDocuments[key] = extracted;
          continue;
        }
        if (value && value.includes("base64")) {
          const uploadDoc = await uploadFileInS3Bucket(value, USER_FOLDER);
          if (uploadDoc !== false) {
            updatedDocuments[key] = uploadDoc.Key; // Update with new document
          } else {
            throw new Error(`${key} upload failed`);
          }
        }
      }
      // Step 6: Update the user details
      const updatedUserData = {
        name,
        image,
        email,
        phone,
        enrollmentNumber,
        dob: dobDate,
        bloodGroup,
        divyang,
        gender,
        identificationMark,
        medicalIssue,
        allergyProblem,
        country,
        nationality: country?.name,
        bulkState: state?.name,
        bulkCity: city?.name,
        state,
        city,
        category,
        cast,
        permanentAddress,
        // currentAddress,
        familiyDetails,
        academicDetails,
        documents: {
          ...updatedDocuments,
          aadhaarNumber: updatedDocuments?.aadharNumber,
        },
        vechicleDetails,
        updatedAt: getCurrentISTTime(),
        updatedBy: staffId,
      };
      if (enrollmentNumber) {
        updatedUserData.enrollmentNumber = enrollmentNumber;
      } else {
        delete (updatedUserData as any).enrollmentNumber;
      }
      // await User.findByIdAndUpdate(studentId, { $set: updatedUserData });
      await User.findByIdAndUpdate(
        { _id: studentId },
        {
          $set: {
            ...updatedUserData,
            vechicleDetails: vechicleDetails || [],
          },
        },
        { new: true },
      );

      const hostelAlloc = await StudentHostelAllocation.findOne({ studentId });
      if (hostelAlloc) {
        await Hostel.findOneAndUpdate(
          {
            _id: hostelAlloc?.hostelId,
          },
          {
            $set: {
              "roomMapping.$[room].bedNumbers.$[bed].isVacant": true,
            },
            $inc: {
              "roomMapping.$[room].vacant": 1,
              "roomMapping.$[room].occupied": -1,
            },
          },
          {
            arrayFilters: [
              {
                "room.floorNumber": Number(hostelAlloc?.floorNumber),
                "room.roomNumber": Number(hostelAlloc?.roomNumber),
              },
              { "bed.bedNumber": String(hostelAlloc?.bedNumber) },
            ],
            new: true,
          },
        );

        await StudentHostelAllocation.findOneAndUpdate(
          { studentId: new mongoose.Types.ObjectId(studentId) },
          {
            $set: {
              floorNumber: Number(floorNumber),
              roomNumber: Number(roomNumber),
              bedNumber: String(bedNumber),
            },
          },
          { new: true }, // returns updated doc
        );
        await Hostel.findOneAndUpdate(
          {
            _id: hostelAlloc?.hostelId,
          },
          {
            $set: {
              "roomMapping.$[room].bedNumbers.$[bed].isVacant": false,
            },
            $inc: {
              "roomMapping.$[room].vacant": -1,
              "roomMapping.$[room].occupied": 1,
            },
          },
          {
            arrayFilters: [
              {
                "room.floorNumber": Number(floorNumber),
                "room.roomNumber": Number(roomNumber),
              },
              { "bed.bedNumber": String(bedNumber) },
            ],
            new: true,
          },
        );
      }

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get users Based On Hostel And Academic
  usersBasedOnHostelAndAcademic = async (
    academicYear: string,
    hostelId: string,
    universityId: mongoose.Types.ObjectId,
    floorNumber?: number,
    courseId?: mongoose.Types.ObjectId,
  ): Promise<{ users: any[] }> => {
    try {
      let studentIds: mongoose.Types.ObjectId[] = [];

      // If floorNumber is provided, fetch students from StudentHostelAllocation
      if (floorNumber !== undefined) {
        const allocatedStudents = await StudentHostelAllocation.find(
          { hostelId: new mongoose.Types.ObjectId(hostelId), floorNumber },
          { studentId: 1 },
        ).lean();

        studentIds = allocatedStudents.map((s) => s.studentId);

        if (studentIds.length === 0) {
          throw new Error(RECORD_NOT_FOUND("Students in hostel floor"));
        }
      }

      // Build match conditions
      const matchConditions: any = {
        "academicDetails.academicYear": academicYear,
        "academicDetails.universityId": new mongoose.Types.ObjectId(
          universityId,
        ),
      };

      // If floorNumber is provided, filter by studentIds
      if (floorNumber && studentIds) {
        matchConditions["_id"] = { $in: studentIds };
      }

      // Only add courseId if it's provided
      if (courseId) {
        matchConditions["academicDetails.courseId"] =
          new mongoose.Types.ObjectId(courseId);
      }

      const users = await User.aggregate([
        { $match: matchConditions },
        {
          $project: {
            _id: 1,
            name: 1,
            phone: 1,
            uniqueId: 1,
          },
        },
      ]);

      if (!users || users.length === 0) {
        throw new Error(RECORD_NOT_FOUND("Users"));
      }

      return { users };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to return playerId and template data
  fetchPlayerNotificationConfig = async (
    studentId: string,
    templateTypes: TemplateTypes,
  ): Promise<{
    playedIds: any[];
    template: any;
    student: any;
    isPlayedNoticeCreated: boolean;
    log?: Pick<INotificationLog, "templateType" | "reason">;
  }> => {
    //NOTE: Get student details
    const student: any = await User.findById(studentId).lean();

    if (!student) {
      return {
        playedIds: [],
        template: null,
        student: null,
        isPlayedNoticeCreated: false,
        log: {
          templateType: templateTypes,
          reason: "student not found",
        },
      };
    }

    //NOTE: Get all OneSignal player IDs
    const playerIds = [
      student?.oneSignalWebId,
      student?.oneSignalAndoridId,
      student?.oneSignalIosId,
    ].filter(Boolean);

    //NOTE: Check template exists
    const result: any = await checkTemplateExist(
      student?.hostelId,
      templateTypes,
    );

    //NOTE: Check template found or not.
    let isPlayedNoticeCreated = true;

    if (!result.template) {
      isPlayedNoticeCreated = false;
    }

    return {
      playedIds: playerIds,
      template: result.template,
      student,
      isPlayedNoticeCreated,
    };
  };

  //SECTION: Method to get student hostel details by userId and hostelId
  getStudentAllocatedHostelDetails = async (
    userId: string,
    hotelId: string,
    templateTypes?: TemplateTypes,
  ): Promise<{
    hostelDetail: any;
    hostelLogs?: Pick<INotificationLog, "templateType" | "reason">;
    isHostelNoticeCreated: boolean;
  }> => {
    const hostelDetail: any = {};
    let hostelLogs:
      | Pick<INotificationLog, "templateType" | "reason">
      | undefined;
    let isHostelNoticeCreated = true;

    try {
      const result = await StudentHostelAllocation.findOne({
        studentId: new mongoose.Types.ObjectId(userId),
        hostelId: new mongoose.Types.ObjectId(hotelId),
      });

      if (!result) {
        hostelLogs = {
          templateType: templateTypes!,
          reason: NO_HOSTEL_FOR_THIS_STUDENT,
        };
        return { hostelDetail, hostelLogs, isHostelNoticeCreated: false };
      }

      return { hostelDetail: result, hostelLogs, isHostelNoticeCreated };
    } catch (error: any) {
      hostelLogs = {
        templateType: templateTypes!,
        reason: error.message,
      };
      return { hostelDetail, hostelLogs, isHostelNoticeCreated: false };
    }
  };

  //SECTION: Method to update user status — active, inactive, or left.
  updateUserStatus = async (
    id: string,
    userStatus: UserGetByTypes,
    staffId: string,
  ): Promise<string> => {
    try {
      //NOTE: Determine the user's intended status based on the input type.
      const isActive = userStatus === UserGetByTypes.ACTIVE;
      const isLeft = userStatus === UserGetByTypes.LEFT_USER;

      //NOTE: Fetch user details by ID.
      const userDetails: any = await User.findById(id);
      if (!userDetails) throw new Error(RECORD_NOT_FOUND("User"));

      //NOTE: Fetch user hotel allocation details.
      const studentHostelDetails = await StudentHostelAllocation.exists({
        studentId: id,
      });
      if (!studentHostelDetails) throw new Error(NO_HOSTEL_FOR_THIS_STUDENT);

      //NOTE: Prevent activating a student who has no hostel allocated and is currently inactive.
      if (
        (!studentHostelDetails && !userDetails?.isVerified && isActive) ||
        (!userDetails?.isVerified && isActive)
      ) {
        throw new Error(ALLOCATE_HOSTEL_STUDENT_TO_ACTIVE);
      }

      //NOTE: Handle "left" status logic.
      if (isLeft) {
        //NOTE: Cannot mark as left if no hostel is allocated and student is already inactive.
        if (!studentHostelDetails || !userDetails?.isVerified) {
          throw new Error(ALLOCATE_HOSTEL_STUDENT_TO_ACTIVE);
        }

        //NOTE: Cannot mark as left if student is still active in the hostel.
        if (userDetails?.isVerified && userDetails?.status) {
          throw new Error(USER_STILL_ACTIVE);
        }

        //NOTE: Mark student as left.
        await User.findByIdAndUpdate(id, {
          $set: {
            isLeft: true,
            leftDate: getCurrentISTTime(),
            updatedBy: staffId,
            updatedAt: getCurrentISTTime(),
          },
        });
      } else {
        //NOTE: Mark student as active/inactive using isActive key and reset left status.
        await User.findByIdAndUpdate(id, {
          $set: {
            status: isActive,
            isLeft: false,
            leftDate: null,
            updatedBy: staffId,
            updatedAt: getCurrentISTTime(),
          },
        });
      }

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  // ANCHOR - validate Staff With Email And Phone
  validateUser = async ({
    email,
    phone,
    enrollmentNumber,
    studentId,
  }: {
    email: string;
    phone: number;
    enrollmentNumber: string;
    studentId?: string;
  }): Promise<boolean> => {
    // Build the query condition
    const query: any = {
      $or: [{ email }, { phone }, { enrollmentNumber }],
    };

    // If studentId is provided, exclude it from the query
    if (studentId) {
      query._id = { $ne: studentId };
    }

    // Check if a user exists with the same email, phone, or enrollment number
    const checkUser = await User.findOne(query);

    if (checkUser) {
      if (
        checkUser.email === email &&
        checkUser.phone === phone &&
        checkUser.enrollmentNumber === enrollmentNumber
      ) {
        throw new Error(
          ALREADY_EXIST_FIELD_TWO("Email", "Phone and EnrollmentNumber"),
        );
      } else if (checkUser.email === email) {
        throw new Error(ALREADY_EXIST_FIELD_ONE("Email"));
      } else if (checkUser.phone === phone) {
        throw new Error(ALREADY_EXIST_FIELD_ONE("Phone"));
      } else if (checkUser.enrollmentNumber === enrollmentNumber) {
        throw new Error(ALREADY_EXIST_FIELD_ONE("EnrollmentNumber"));
      }
    }

    return true;
  };

  //ANCHOR - generate unique YOCO Id
  generateUniqueYocoId = async (
    prefix: string,
    hostelId: mongoose.Types.ObjectId,
  ): Promise<string> => {
    try {
      // Find the user with the highest uniqueId for the given hostelId
      const lastUser = await User.findOne(
        { hostelId, uniqueId: { $ne: null } },
        { uniqueId: 1 },
      )
        .sort({ createdAt: -1 }) // safer than string sorting
        .lean();
      // .sort({ uniqueId: -1 })
      // .exec();
      // Default uniqueId if no previous user is found
      let newUniqueId = `${prefix}-001`;

      if (lastUser && lastUser.uniqueId) {
        // Split on the last dash to isolate the numeric part only
        const lastIdNumber = parseInt(
          lastUser.uniqueId.substring(lastUser.uniqueId.lastIndexOf("-") + 1),
          10,
        );
        // Check if parsing was successful
        if (!isNaN(lastIdNumber)) {
          const incrementedId = lastIdNumber + 1;
          newUniqueId = `${prefix}-${incrementedId
            .toString()
            .padStart(3, "0")}`;
        } else {
          throw new Error("Failed to parse last uniqueId number.");
        }
      }
      return newUniqueId;
    } catch (error) {
      throw new Error(UNIQUE_GENERATE_FAILED);
    }
  };

  deleteStudent = async (
    id: string | mongoose.Types.ObjectId,
  ): Promise<string> => {
    try {
      const hostel = await StudentHostelAllocation.findOne({ studentId: id });
      await Hostel.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(hostel?.hostelId),
          "roomMapping.floorNumber": hostel?.floorNumber,
          "roomMapping.roomNumber": hostel?.roomNumber,
          "roomMapping.bedNumbers": {
            $elemMatch: {
              bedNumber: String(hostel?.bedNumber),
              isVacant: false,
            },
          },
        },
        {
          $set: {
            "roomMapping.$[room].bedNumbers.$[bed].isVacant": true,
          },
          $inc: {
            "roomMapping.$[room].vacant": 1,
            "roomMapping.$[room].occupied": -1,
          },
        },
        {
          arrayFilters: [
            {
              "room.floorNumber": hostel?.floorNumber,
              "room.roomNumber": hostel?.roomNumber,
            },
            { "bed.bedNumber": String(hostel?.bedNumber) },
          ],
          new: true,
        },
      );

      const userExist = await User.findOneAndDelete({ _id: id });
      if (userExist) {
        await Promise.all([
          StudentLeave.deleteMany({ userId: id }),
          Complaint.deleteMany({ userId: id }),
          BookMeals.deleteMany({ studentId: id }),
          StudentHostelAllocation.findOneAndDelete({ studentId: id }),
          Token.findOneAndDelete({ userId: id }),
        ]);

        return DELETE_DATA;
      } else {
        throw new Error(RECORD_NOT_FOUND("User"));
      }
    } catch (error) {
      throw new Error(RECORD_NOT_FOUND("User"));
    }
  };

  userRequestDeactivate = async (email: string) => {
    try {
      const user = await User.findOne({ email });

      if (!user) {
        throw new Error("User not found");
      }

      // Already requested
      if (user.isRequestDeactivate === true) {
        throw new Error("Already request sent");
      }
      await User.findOneAndUpdate(
        { email: email },
        { $set: { isRequestDeactivate: true } },
        { new: true },
      );
      return "Activation request sent";
    } catch (error: any) {
      throw new Error(error.message || "Failed to Verify OTP");
    }
  };
}

export default new UserService();
