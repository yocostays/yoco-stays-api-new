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
import { hashPassword } from "../utils/hashUtils";
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
    oneSignalIosId?: string
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
        aadhaarCard: documents?.aadhaarCard
          ? await getSignedUrl(documents.aadhaarCard)
          : null,
        passport: documents?.passport
          ? await getSignedUrl(documents.passport)
          : null,
        voterCard: documents?.voterCard
          ? await getSignedUrl(documents.voterCard)
          : null,
        drivingLicense: documents?.drivingLicense
          ? await getSignedUrl(documents.drivingLicense)
          : null,
        panCard: documents?.panCard
          ? await getSignedUrl(documents.panCard)
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
    academicYear?: string
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
      const searchParams: any = {};

      // Set isVerified based on the status
      if (status === UserGetByTypes.ACTIVE) {
        searchParams.isVerified = true;
      } else if (status === UserGetByTypes.INACTIVE) {
        searchParams.isVerified = false;
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
            .select("joiningDate roomNumber floorNumber")
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
        })
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
    hostelId?: string
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
    staffId: mongoose.Types.ObjectId
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
        hostel?._id
      );

      // Step 2: Hash the password
      const hashedPassword = await hashPassword("123456789");

      // Generate billingCycleDetails based on the billing cycle type
      const billingDetails = createBillingCycleDetails(
        hostel.bedDetails[0]?.accommodationFee,
        billingCycle
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
          { new: true } // Return the updated document
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
        }
      );

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to update student in app
  updateStudentInApp = async (
    studentId: mongoose.Types.ObjectId,
    email: string,
    image: string
  ): Promise<string> => {
    try {
      const studentExists: any = await User.findById(studentId);
      if (!studentExists) throw new Error(RECORD_NOT_FOUND("User"));

      // Check if the email is already in use by another user
      const checkUser: any = await User.findOne({
        _id: { $ne: studentId },
        email,
      });

      if (checkUser) throw new Error(ALREADY_EXIST_FIELD_ONE("Email"));

      // Get the current user to check if there is an existing image
      const currentUser = await User.findById(studentId);
      let payload: { email: string; image?: string } = { email };

      if (image && image.includes("base64")) {
        const uploadImage = await uploadFileInS3Bucket(image, USER_FOLDER);

        if (uploadImage !== false) {
          // Update the payload with the new image's S3 key
          payload = { ...payload, image: uploadImage.Key };

          // After uploading, check if there is an existing image to delete
          if (currentUser?.image) {
            const existingImageKey = currentUser.image;
            await deleteFromS3(
              process.env.S3_BUCKET_NAME ?? "yoco-staging",
              existingImageKey
            );
          }
        } else {
          throw new Error(IMAGE_UPLOAD_ERROR);
        }
      }

      // Update the user's email and image in the database
      const userUpdated = await User.findByIdAndUpdate(studentId, {
        $set: payload,
      });

      //NOTE: Check user is updated or not.
      if (userUpdated) {
        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await this.fetchPlayerNotificationConfig(
            studentExists?._id,
            TemplateTypes.PROFILE_UPDATED
          );

        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await this.getStudentAllocatedHostelDetails(
            student?._id,
            student?.hostelId,
            TemplateTypes.PROFILE_UPDATED
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
          templateSendMessage: template?.description,
          isNoticeCreated: finalNoticeCreated,
          notificationLog,
          createdAt: getCurrentISTTime(),
        });
        //NOTE: Proceed to send push notification only when isNoticeCreated is true.
        if (finalNoticeCreated) {
          //NOTE: Use the send push notification function
          await sendPushNotificationToUser(
            playedIds,
            template?.title,
            template?.description,
            template?.image,
            TemplateTypes.PROFILE_UPDATED
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
    studentId: mongoose.Types.ObjectId
  ): Promise<{ response: any }> => {
    try {
      // Check if the student exists
      const studentExists = await User.exists({ _id: studentId });
      if (!studentExists) throw new Error(RECORD_NOT_FOUND("User"));

      // Fetch the student's information
      const checkUser: any = await User.findOne({
        _id: studentId,
      }).select(
        "uniqueId name email phone image hostelId vechicleDetails indisciplinaryAction familiyDetails bloodGroup dob documents academicDetails"
      );

      // Fetch the room details for the student
      const studentRoomDetails = await StudentHostelAllocation.findOne({
        studentId: studentId,
        hostelId: checkUser.hostelId,
      })
        .select("roomNumber")
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
        })
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
        name: checkUser?.name ?? null,
        uniqueId: checkUser?.uniqueId ?? null,
        email: checkUser?.email ?? null,
        phone: checkUser?.phone ?? null,
        image: checkUser?.image ? await getSignedUrl(checkUser?.image) : null,
        bloodGroup: checkUser?.bloodGroup ?? null,
        dob: checkUser?.dob ?? null,
        semester: checkUser?.academicDetails?.semester ?? null,
        fatherName: checkUser?.familiyDetails?.fatherName ?? null,
        fatherNumber: checkUser?.familiyDetails?.fatherNumber ?? null,
        motherName: checkUser?.familiyDetails?.motherName ?? null,
        motherNumber: checkUser?.familiyDetails?.motherNumber ?? null,
        fatherEmail: checkUser?.familiyDetails?.fatherEmail ?? null,
        motherEmail: checkUser?.familiyDetails?.motherEmail ?? null,
        isVechicleDetailsAdded: checkUser?.vechicleDetails.length > 0,
        vechicleDetails: checkUser?.vechicleDetails ?? null,
        isKycDocumentAdded: !!checkUser?.documents,
        documents: {
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
    vehicleDetails: any[]
  ): Promise<string> => {
    try {
      // Check if the student exists
      const studentExists = await User.exists({ _id: studentId });

      if (!studentExists) throw new Error(RECORD_NOT_FOUND("User"));

      // Update vehicleDetails in bulk
      await User.findByIdAndUpdate(
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
        { new: true }
      );

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get a student by uniqueId
  getStudentByUniqueId = async (
    uniqueId: string
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
    staffId?: string
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
          USER_FOLDER
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
            existingUrl
          );
        }
      } else {
        if (existingUrl) {
          // Delete the existing file from S3 if it exists
          await deleteFromS3(
            process.env.S3_BUCKET_NAME ?? "yoco-staging",
            existingUrl
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
    type: FetchUserTypes
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
          "buildingNumber bedType roomNumber bedNumber floorNumber joiningDate billingCycle"
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
                (u: any) => u._id.toString() === mate.studentId.toString()
              );

              if (user) {
                return {
                  _id: user._id,
                  name: user.name ?? null,
                  email: user.email ?? null,
                  phone: user.phone ?? null,
                  image: user.image ? await getSignedUrl(user.image) : null,
                  roomDetails: `${mate.roomNumber ?? null}/${mate.bedNumber ?? null
                    }`,
                };
              }

              return null;
            })
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
    staffId: string
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
        { new: true }
      );

      //NOTE: Check user leave applied or not.
      if (userUpdate) {
        const { playedIds, template, student, isPlayedNoticeCreated, log } =
          await this.fetchPlayerNotificationConfig(
            userUpdate?._id,
            TemplateTypes.USER_ROLE_UPDATED
          );
        let description: any = {};

        //NOTE: Get student and hostelDetails
        const { hostelDetail, hostelLogs, isHostelNoticeCreated } =
          await this.getStudentAllocatedHostelDetails(
            studentId,
            student?.hostelId
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
            template?.image,
            TemplateTypes.USER_ROLE_UPDATED
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
    hostelId: mongoose.Types.ObjectId,
    bedType: BedTypes,
    buildingNumber: string,
    floorNumber: number,
    roomNumber: number,
    bedNumber: string,
    billingCycle: BillingCycleTypes,
    vechicleDetails: any[],
    staffId: string,
    image?: string
  ): Promise<{ uniqueId: string }> => {
    try {
      //NOTE - get university capacity
      const university = await College.findById(academicDetails?.universityId);

      if (!university) throw new Error(RECORD_NOT_FOUND("University"));

      // Get the user count for the current university
      const userCount = await User.countDocuments({
        "academicDetails.universityId": university._id,
      });

      if (userCount >= university.totalCapacity)
        throw new Error(TOTAL_CAPACITY_ISSUES);

      const currentDate = new Date();
      currentDate.setUTCHours(0, 0, 0, 0);

      // Step 1: Validate staff by email and phone
      await this.validateUser({ email, phone, enrollmentNumber });

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
        hostel?._id
      );

      // Step 2: Hash the password
      const hashedPassword = await hashPassword("123456789");

      // Generate billingCycleDetails based on the billing cycle type
      const billingDetails = createBillingCycleDetails(
        hostel.bedDetails[0]?.accommodationFee,
        billingCycle
      );

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
        billingCycleDetails: billingDetails,
        joiningDate: currentDate,
        createdBy: staffId,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      // Step 7: Update the hostel bed mapping
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
        }
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
    staffId?: string
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

  //   //SECTION: Method to bulk upload user
  //   userBulkUpload = async (
  //     jsonData: any[],
  //     staffId: string,
  //     hostelId: string,
  //     universityId: string,
  //     url?: any
  //   ) => {
  //     let successArray: any[] = [];
  //     let errorArray: any[] = [];
  //     try {
  //       const validGenders = ["male", "female", "other", "not selected"];
 
  //       const schema = Joi.object({
  //         // Timestamp: Joi.date().timestamp().optional(),
  //         gender: Joi.string().valid(...validGenders).default("not selected"),
  //         "Date of Birth": Joi.date()
  //           .required()
  //           .messages({
  //             "any.required": "Date of Birth is required",
  //             "date.base": "Invalid Date format for Date of Birth",
  //           }),
  //         "Full Name of Student": Joi.string().required(),
  //         "Mobile Number of Student": Joi.number().integer().min(1000000000).max(9999999999).required().messages({
  //           "string.pattern.base": "Mobile Number must be exactly 10 digits",
  //           "any.required": "Mobile Number is required",
  //           "number.min": "Mobile Number must be exactly 10 digits",
  //           "number.max": "Mobile Number must be exactly 10 digits",
  //         }),
  //         "Father's Name": Joi.string().required(),
  //         "Mother's Name": Joi.string().required(),
  //         "Parent's Mobile Number": Joi.number().integer().min(1000000000).max(9999999999).required().messages({
  //           "string.pattern.base": "Mobile Number must be exactly 10 digits",
  //           "any.required": "Mobile Number is required",
  //           "number.min": "Mobile Number must be exactly 10 digits",
  //           "number.max": "Mobile Number must be exactly 10 digits",
  //         }),
  //         "Permanent Address": Joi.string().required(),
  //         "Hostel Name": Joi.string().required(),
  //         "Aadhaar Number": Joi.number().integer().min(100000000000).max(999999999999).required().messages({
  //           "string.pattern.base": "Aadhaar Number must be exactly 12 digits",
  //           "any.required": "Aadhaar Number is required",
  //           "number.min": "Aadhaar Number must be exactly 12 digits",
  //           "number.max": "Aadhaar Number must be exactly 12 digits",
  //         }),
  //         "Country": Joi.string().required(),
  //         "State": Joi.string().required(),
  //         "City": Joi.string().required(),
  //       });


  //       for (const item of jsonData) {
  //         let errors: string[] = [];

  //         // ✅ STEP 1: Joi Validation (Collect All Errors)
  //         const { error, value } = schema.validate(item, { abortEarly: false });
  //         if (error) {
  //           error.details.forEach((err: any) => {
  //             const field = err.context.label || err.context.key;
  //             const message = err.message.replace(/"/g, "");
  //             errors.push(`${field}: ${message}`);
  //           });
  //         }

  //         // ✅ STEP 2: DB Validation - Check Phone Exists
  //         if (value?.["Mobile Number of Student"]) {
  //           const phoneExists = await User.findOne({
  //             phone: value["Mobile Number of Student"],
  //           });
  //           if (phoneExists) {
  //             errors.push(`Mobile Number of Student: Phone number already exists`);
  //           }
  //         }


  //         // ✅ STEP 3: Push to Correct Array (No Duplicate Rows)
  //         if (errors.length > 0) {
  //           errorArray.push({
  //             ...item,
  //             errors: errors.join(" | "), // 👉 Excel Friendly Format
  //           });
  //         } else {
  //           successArray.push({
  //             ...item,
  //             errors: null,
  //           });
  //         }
  //       }


  //       //NOTE - get university capacity
  //       const university = await College.findById(universityId);

  //       if (!university) throw new Error(RECORD_NOT_FOUND("University"));

  //       // Get the user count for the current university
  //       const userCount = await User.countDocuments({
  //         "academicDetails.universityId": university._id,
  //       });

  //       if (userCount >= university.totalCapacity)
  //         throw new Error(TOTAL_CAPACITY_ISSUES);

  //       const currentDate = new Date();
  //       currentDate.setUTCHours(0, 0, 0, 0);

  //       //NOTE - get role
  //       const { role } = await getRoleByName("student");

  //       // Create an entry in the bulk upload table
  //       const bulkUpload = await BulkUpload.create({
  //         originalFile: url,
  //         createdBy: staffId,
  //         createdAt: getCurrentISTTime(),
  //         updatedAt: getCurrentISTTime(),
  //       });

  //       for (let data of successArray) {
  //         try {
  //           const {
  //             "Full Name of Student": name,
  //             "Mobile Number of Student": phone,
  //             Gender: gender,
  //             Nationality: nationality,
  //             State: state,
  //             City: city,
  //             "Date of Birth": dobExcel,
  //             "Permanent Address": permanentAddress,
  //             "Father's Name": fatherName,
  //             "Mother's Name": motherName,
  //             "Parent's Mobile Number": parentsContactNo,
  //             "Aadhaar Number": aadharNumber,
  //             "Room Number": roomNumber,
  //             // "Bed Number": bedNumber,
  //             // "Billing Cycle": billingCycle,
  //           } = data;

  //           // Validate mandatory fields (e.g., email, phone)
  //           // if (phone) {
  //           //   errorArray.push({
  //           //     ...data,
  //           //     error: "phone number already exist",
  //           //   });
  //           //   continue;
  //           // }

  //           // Check if email or phone already exists
  //           // const existingUser = await User.findOne({
  //           //   $or: [{ email }, { phone }, { enrollmentNumber }],
  //           // });
  //           // const existingUser = await User.findOne({
  //           //   $or: [{ phone }],
  //           // });
  //           const existingUser = await User.findOne({ phone: phone })
  //           if (existingUser) {
  //             continue
  //           }
  //           // if (existingUser) {
  //           //   errorArray.push({
  //           //     ...data,
  //           //     error: "Email or phone or enrollmentNumber already exists",
  //           //   });
  //           //   continue;
  //           // }

  //           // if (existingUser) {
  //           //   errorArray.push({
  //           //     ...data,
  //           //     error: "User/Phone No. already exists",
  //           //   });
  //           //   continue;
  //           // }
  //           //NOTE - find the course id based on the name
  //           // const course = await Course.findOne({
  //           //   name: { $regex: courseName, $options: "i" },
  //           // });

  //           // if (!course) {
  //           //   errorArray.push({ ...data, error: "Course not found." });
  //           //   continue;
  //           // }

  //           // If the course is found, check if it's in the College
  //           // const college = await College.findOne({
  //           //   _id: university._id,
  //           //   courseIds: { $elemMatch: { $eq: course._id } },
  //           // });

  //           // if (!college) {
  //           //   errorArray.push({
  //           //     ...data,
  //           //     error: "Course not associated with the College.",
  //           //   });
  //           //   continue;
  //           // }
  //           // Convert Excel date to JavaScript date
  //           // const dob = new Date((dobExcel - 25569) * 86400 * 1000);
  //           // const dob = new Date(dobExcel)
  //           // Get the student's hostel information
  //           const [hostel] = await Hostel.aggregate([
  //             { $match: { _id: new mongoose.Types.ObjectId(hostelId) } },
  //             {
  //               $project: {
  //                 _id: 1,
  //                 buildingNumber: 1,
  //                 identifier: 1,
  //                 securityFee: 1,
  //                 // bedDetails: {
  //                 //   $filter: {
  //                 //     input: "$bedDetails",
  //                 //     as: "bedDetail",
  //                 //     cond: { $eq: ["$$bedDetail.bedType", bedType] },
  //                 //   },
  //                 // },
  //                 // roomDetails: {
  //                 //   $filter: {
  //                 //     input: "$roomMapping",
  //                 //     as: "room",
  //                 //     cond: {
  //                 //       $and: [
  //                 //         { $eq: ["$$room.roomNumber", roomNumber] },
  //                 //         {
  //                 //           $gt: [
  //                 //             {
  //                 //               $size: {
  //                 //                 $filter: {
  //                 //                   input: "$$room.bedNumbers",
  //                 //                   as: "bed",
  //                 //                   cond: {
  //                 //                     $eq: ["$$bed.bedNumber", String(bedNumber)],
  //                 //                   },
  //                 //                 },
  //                 //               },
  //                 //             },
  //                 //             0,
  //                 //           ],
  //                 //         },
  //                 //       ],
  //                 //     },
  //                 //   },
  //                 // },
  //               },
  //             },
  //             // { $unwind: "$roomDetails" },
  //             // {
  //             //   $project: {
  //             //     _id: 1,
  //             //     buildingNumber: 1,
  //             //     identifier: 1,
  //             //     securityFee: 1,
  //             //     // bedDetails: 1,
  //             //     // roomDetails: {
  //             //     //   roomNumber: 1,
  //             //     //   floorNumber: 1,
  //             //     //   bedNumbers: {
  //             //     //     $filter: {
  //             //     //       input: "$roomDetails.bedNumbers",
  //             //     //       as: "bed",
  //             //     //       cond: { $eq: ["$$bed.bedNumber", String(bedNumber)] },
  //             //     //     },
  //             //     //   },
  //             //     // },
  //             //   },
  //             // },
  //           ]);
  //           // if (!hostel) {
  //           //   errorArray.push({ ...data, error: "Hostel not found" });
  //           //   continue;
  //           // }

  //           // Generate a unique ID for the student
  //           const uniqueId = await this.generateUniqueYocoId(
  //             hostel?.identifier,
  //             hostel?._id
  //           );

  //           // Hash a default password for the user
  //           const hashedPassword = await hashPassword("123456789");

  //           // // Generate billing cycle details
  //           // const billingDetails = createBillingCycleDetails(
  //           //   hostel.bedDetails[0]?.accommodationFee,
  //           //   billingCycle
  //           // );

  //           // Create the new user

  //           const newUser = new User({
  //             roleId: role._id,
  //             uniqueId,
  //             permanentAddress,
  //             parentsContactNo,
  //             documents: {
  //               aadhaarNumber: String(aadharNumber)
  //             },
  //             name: name.toUpperCase(),
  //             password: hashedPassword,
  //             phone,
  //             dob: dobExcel,
  //             gender: gender,
  //             nationality: nationality,
  //             bulkState: state,
  //             bulkCity: city,
  //             familiyDetails: {
  //               fatherName,
  //               parentsContactNo,
  //               motherName,
  //             },
  //             hostelId: hostel?._id,
  //             isVerified: true,
  //             verifiedBy: staffId,
  //             createdAt: getCurrentISTTime(),
  //             updatedAt: getCurrentISTTime(),
  //             createdBy: staffId,
  //           });

  //           await newUser.save();
  //           // Allocate the student to the hostel
  //           await StudentHostelAllocation.create({
  //             studentId: newUser._id,
  //             hostelId: hostel._id,
  //             buildingNumber: hostel?.buildingNumber,
  //             roomNumber,
  //             // bedNumber: hostel.roomDetails?.bedNumbers[0]._id,
  //             // floorNumber: hostel.roomDetails?.floorNumber,
  //             securityFee: hostel?.securityFee,
  //             // billingCycle: billingCycle.toLowerCase(),
  //             joiningDate: currentDate,
  //             createdBy: staffId,
  //             createdAt: getCurrentISTTime(),
  //             updatedAt: getCurrentISTTime(),
  //           });

  //           //NOTE - update in hostel
  //           // await Hostel.findOneAndUpdate(
  //           //   { _id: hostelId, "roomMapping.roomNumber": roomNumber },
  //           //   {
  //           //     $inc: {
  //           //       "roomMapping.$.vacant": -1,
  //           //       "roomMapping.$.occupied": 1,
  //           //     },
  //           //     $set: { "roomMapping.$.bedNumbers.$[bed].isVacant": false },
  //           //   },
  //           //   {
  //           //     new: true,
  //           //     runValidators: true,
  //           //     arrayFilters: [{ "bed.bedNumber": bedNumber }],
  //           //   }
  //           // );

  //           // Push success details (add the full original data to the success array)
  //           // successArray.push(data);
  //           // console.log(successArray, errorArray, "errrr")
  //         } catch (error: any) {
  //           // Catch errors for individual student data and push to errorArray
  //           errorArray.push({ ...data, error: error.message });
  //         }
  //       }
  //       // If there are successes or errors, generate CSV/Excel files and upload them to AWS S3
  //       let successFileUrl = null;
  //       let errorFileUrl = null;
  //       if (successArray.length > 0) {
  //         const successFilePath = await pushToS3Bucket(
  //           successArray,
  //           process.env.S3_BUCKET_NAME as string,
  //           USER_BULK_UPLOAD_FILES
  //         );
  //         successFileUrl = successFilePath;
  //       }
  //       if (errorArray.length > 0) {
  //         const errorFilePath = await pushToS3Bucket(
  //           errorArray,
  //           process.env.S3_BUCKET_NAME as string,
  //           USER_BULK_UPLOAD_FILES
  //         );
  //         errorFileUrl = errorFilePath;
  //       }

  //       console.log(successArray,errorArray,"error")
  //       console.log(successFileUrl,errorFileUrl,"file")
  //       //NOTE - update bulk upload
  //       await BulkUpload.findByIdAndUpdate(bulkUpload._id, {
  //         $set: {
  //           successFile: successFileUrl,
  //           errorFile: errorFileUrl,
  //           updatedAt: getCurrentISTTime(),
  //         },
  //       });

  //       return FILE_UPLOADED;
  //     } catch (error: any) {
  //       throw new Error(`${error.message}`);
  //     }
  //   };
  // SECTION: Method to bulk upload user
  userBulkUpload = async (
    jsonData: any[],
    staffId: string,
    hostelId: string,
    universityId: string,
    url?: any
  ) => {
    let successArray: any[] = [];
    let errorArray: any[] = [];

    try {
      const validGenders = ["male", "female", "other", "not selected"];
      // Schema Validation
      const schema = Joi.object({
        // Timestamp: Joi.date().timestamp().optional(),
        gender: Joi.string().valid(...validGenders).default("not selected"),
        "Date of Birth": Joi.date()
          .required()
          .messages({
            "any.required": "Date of Birth is required",
            "date.base": "Invalid Date format for Date of Birth",
          }),
        "Full Name of Student": Joi.string().required(),
        "Mobile Number of Student": Joi.number().integer().min(1000000000).max(9999999999).required().messages({
          "string.pattern.base": "Mobile Number must be exactly 10 digits",
          "any.required": "Mobile Number is required",
          "number.min": "Mobile Number must be exactly 10 digits",
          "number.max": "Mobile Number must be exactly 10 digits",
        }),
        "Father's Name": Joi.string().required(),
        "Mother's Name": Joi.string().required(),
        "Parent's Mobile Number": Joi.number().integer().min(1000000000).max(9999999999).required().messages({
          "string.pattern.base": "Mobile Number must be exactly 10 digits",
          "any.required": "Mobile Number is required",
          "number.min": "Mobile Number must be exactly 10 digits",
          "number.max": "Mobile Number must be exactly 10 digits",
        }),
        "Permanent Address": Joi.string().required(),
        "Hostel Name": Joi.string().required(),
        "Aadhaar Number": Joi.number().integer().min(100000000000).max(999999999999).required().messages({
          "string.pattern.base": "Aadhaar Number must be exactly 12 digits",
          "any.required": "Aadhaar Number is required",
          "number.min": "Aadhaar Number must be exactly 12 digits",
          "number.max": "Aadhaar Number must be exactly 12 digits",
        }),
        "Country": Joi.string().required(),
        "State": Joi.string().required(),
        "City": Joi.string().required(),
      });


      // Validate and classify entries
      for (const item of jsonData) {
        let errors: string[] = [];

        const { error, value } = schema.validate(item, { abortEarly: false });
        if (error) {
          error.details.forEach((err: any) => {
            const field = err.context.label || err.context.key;
            const message = err.message.replace(/"/g, "");
            errors.push(`${field}: ${message}`);
          });
        }
        // Check for duplicate phone
        if (value?.["Mobile Number of Student"]) {
          const phoneExists = await User.findOne({
            phone: value["Mobile Number of Student"],
          });
          if (phoneExists) {
            errors.push(`Mobile Number of Student: Phone number already exists`);
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

      // Process valid entries
      for (let data of successArray) {
        try {
          const {
            "Full Name of Student": name,
            "Mobile Number of Student": phone,
            Gender: gender,
            Country: nationality,
            State: state,
            City: city,
            "Date of Birth": dobExcel,
            "Permanent Address": permanentAddress,
            "Father's Name": fatherName,
            "Mother's Name": motherName,
            "Parent's Mobile Number": parentsContactNo,
            "Aadhaar Number": aadharNumber,
            "Room Number": roomNumber,
          } = data;

          // Double-check phone not taken during save
          const existingUser = await User.findOne({ phone });
          if (existingUser) {
            errorArray.push({ ...data, errors: "Mobile number already exists during save" });
            continue;
          }

          // Get hostel info
          const [hostel] = await Hostel.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(hostelId) } },
            {
              $project: {
                _id: 1,
                buildingNumber: 1,
                identifier: 1,
                securityFee: 1,
              },
            },
          ]);

          const uniqueId = await this.generateUniqueYocoId(
            hostel?.identifier,
            hostel?._id
          );

          const hashedPassword = await hashPassword("123456789");

          const newUser = new User({
            roleId: role._id,
            uniqueId,
            permanentAddress,
            parentsContactNo,
            documents: {
              aadhaarNumber: aadharNumber,
            },
            name: name.toUpperCase(),
            password: hashedPassword,
            phone,
            dob: dobExcel,
            gender,
            nationality,
            bulkState: state,
            bulkCity: city,
            familiyDetails: {
              fatherName,
              parentsContactNo,
              motherName,
            },
            hostelId: hostel?._id,
            isVerified: true,
            verifiedBy: staffId,
            createdAt: getCurrentISTTime(),
            updatedAt: getCurrentISTTime(),
            createdBy: staffId,
          });

          await newUser.save();

          await StudentHostelAllocation.create({
            studentId: newUser._id,
            hostelId: hostel._id,
            buildingNumber: hostel?.buildingNumber,
            roomNumber,
            securityFee: hostel?.securityFee,
            joiningDate: currentDate,
            createdBy: staffId,
            createdAt: getCurrentISTTime(),
            updatedAt: getCurrentISTTime(),
          });
        } catch (error: any) {
          console.error("Error saving user record:", error.message);
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
            USER_BULK_UPLOAD_FILES
          );
        }

        if (errorArray.length > 0) {
          errorFileUrl = await pushToS3Bucket(
            errorArray,
            process.env.S3_BUCKET_NAME!,
            USER_BULK_UPLOAD_FILES
          );
        }


        if (bulkUpload?._id && (successFileUrl || errorFileUrl)) {
          await BulkUpload.findByIdAndUpdate(bulkUpload._id, {
            $set: {
              ...(successFileUrl && { successFile: successFileUrl }),
              ...(errorFileUrl && { errorFile: errorFileUrl }),
              updatedAt: getCurrentISTTime(),
            },
          });
        } else {
          console.warn("⚠️ No file URLs generated or _id missing — skipping update");
        }
      } catch (err) {
        console.error("🚨 Error during file generation/upload:", err);
      }

      return FILE_UPLOADED;
    } catch (error: any) {
      console.error("Bulk upload failed:", error.message);
      throw new Error(`${error.message}`);
    }
  };


  //SECTION: Method to delete user Vehicle details
  deleteVehicle = async (
    vehicleId: string,
    userId: string
  ): Promise<string> => {
    try {
      const result = await User.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(userId) },
        {
          $pull: {
            vechicleDetails: { _id: new mongoose.Types.ObjectId(vehicleId) },
          },
        },
        { new: true }
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
    currentAddress: string,
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
    image?: string
  ): Promise<string> => {
    try {
      // Step 1: Validate and fetch existing student
      const student = await User.findById(studentId).lean();
      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      // Step 2: Validate university
      const university = await College.findById(academicDetails?.universityId);
      if (!university) throw new Error(RECORD_NOT_FOUND("University"));

      // Step 3: Validate staff details
      await this.validateUser({ email, phone, enrollmentNumber, studentId });

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
      let updatedDocuments: any = { ...student.documents };
      for (const [key, value] of Object.entries(documents)) {
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
        state,
        city,
        category,
        cast,
        permanentAddress,
        currentAddress,
        familiyDetails,
        academicDetails,
        documents: updatedDocuments,
        vechicleDetails,
        updatedAt: getCurrentISTTime(),
        updatedBy: staffId,
      };

      await User.findByIdAndUpdate(studentId, { $set: updatedUserData });

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
    courseId?: mongoose.Types.ObjectId
  ): Promise<{ users: any[] }> => {
    try {
      let studentIds: mongoose.Types.ObjectId[] = [];

      // If floorNumber is provided, fetch students from StudentHostelAllocation
      if (floorNumber !== undefined) {
        const allocatedStudents = await StudentHostelAllocation.find(
          { hostelId: new mongoose.Types.ObjectId(hostelId), floorNumber },
          { studentId: 1 }
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
          universityId
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
    templateTypes: TemplateTypes
  ): Promise<{
    playedIds: any[];
    template: any;
    student: any;
    isPlayedNoticeCreated: boolean;
    log?: Pick<INotificationLog, "templateType" | "reason">;
  }> => {
    let playedIds: any[] = [];
    let template: any = null;
    let student: any = null;
    let isPlayedNoticeCreated = true;
    let log: Pick<INotificationLog, "templateType" | "reason">;
    try {
      // NOTE: Retrieve student details
      student = await User.findById(studentId).select(
        "oneSignalWebId oneSignalAndoridId oneSignalIosId hostelId"
      );
      if (!student) {
        log = {
          templateType: templateTypes,
          reason: RECORD_NOT_FOUND("Student"),
        };
        return {
          playedIds,
          template,
          student,
          isPlayedNoticeCreated: false,
          log,
        };
      }

      // NOTE: Check playerIds is available
      const playerIds: any = [
        student.oneSignalWebId,
        student.oneSignalAndoridId,
        student.oneSignalIosId,
      ].filter(Boolean);

      if (playerIds.length === 0) {
        log = {
          templateType: templateTypes,
          reason: ONE_SIGNAL_PLAYERS_NOT_FOUND,
        };
        return {
          playedIds,
          template,
          student,
          isPlayedNoticeCreated: false,
          log,
        };
      }

      // NOTE: Check template availability
      const result: any = await checkTemplateExist(
        student?.hostelId,
        templateTypes
      );

      if (!result?.template) {
        log = {
          templateType: templateTypes,
          reason: RECORD_NOT_FOUND("Template"),
        };
        return {
          playedIds,
          template,
          student,
          isPlayedNoticeCreated: false,
          log,
        };
      }

      if (result?.template?.description) {
        result.template.description = removeHtmlTags(
          result.template.description
        );
      }

      return {
        playedIds: playerIds,
        template: result.template,
        student,
        isPlayedNoticeCreated,
      };
    } catch (error: any) {
      log = {
        templateType: templateTypes,
        reason: error.message,
      };
      return {
        playedIds,
        template,
        student,
        isPlayedNoticeCreated: false,
        log,
      };
    }
  };

  //SECTION: Method to get student hostel details by userId and hostelId
  getStudentAllocatedHostelDetails = async (
    userId: string,
    hotelId: string,
    templateTypes?: TemplateTypes
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
    staffId: string
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
          ALREADY_EXIST_FIELD_TWO("Email", "Phone and EnrollmentNumber")
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
    hostelId: mongoose.Types.ObjectId
  ): Promise<string> => {
    try {
      // Find the user with the highest uniqueId for the given hostelId
      const lastUser = await User.findOne(
        { hostelId, uniqueId: { $ne: null } },
        { uniqueId: 1 }
      )
        .sort({ uniqueId: -1 })
        .exec();

      // Default uniqueId if no previous user is found
      let newUniqueId = `${prefix}-001`;

      if (lastUser && lastUser.uniqueId) {
        // Split on the last dash to isolate the numeric part only
        const lastIdNumber = parseInt(
          lastUser.uniqueId.substring(lastUser.uniqueId.lastIndexOf("-") + 1),
          10
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
}

export default new UserService();
