import mongoose from "mongoose";
import Staff from "../models/staff.model";
import Role from "../models/role.model";
import Complaint from "../models/complaint.model";
import StaffHostelAllocation from "../models/staffHostelAllocation.model";
import Hostel from "../models/hostel.model";
import RoleService from "../services/role.service";
import { getCurrentISTTime, getDateRange } from "../utils/lib";
import {
  VALIDATION_MESSAGES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { hashPassword } from "../utils/hashUtils";
import { deleteFromS3, getSignedUrl } from "../utils/awsUploadService";
import {
  BloodGroupType,
  ComplaintTypes,
  FetchUserTypes,
  Gender,
  ReportDropDownTypes,
  UserGetByTypes,
} from "../utils/enum";
import StaffIndisciplinaryAction from "../models/staffIndisciplinaryAction.model";

const { getRoleByName } = RoleService;

const { ALREADY_EXIST_FIELD_ONE, ALREADY_EXIST_FIELD_TWO } =
  VALIDATION_MESSAGES;
const { CREATE_DATA, UPDATE_DATA, DELETE_DATA } = SUCCESS_MESSAGES;
const { RECORD_NOT_FOUND, DUPLICATE_RECORD, INVALID_STATUS } = ERROR_MESSAGES;

class StaffService {
  //SECTION: Method to create a new staff in warden panel
  createNewStaff = async (
    roleId: mongoose.Types.ObjectId,
    name: string,
    userName: string,
    image: string,
    email: string,
    phone: number,
    dob: Date,
    bloodGroup: BloodGroupType,
    joiningDate: Date,
    gender: Gender,
    fatherName: string,
    motherName: string,
    spouseName: string,
    shiftStartTime: string,
    shiftEndTime: string,
    vechicles: any,
    kycDocuments: any,
    assignedHostelIds?: mongoose.Types.ObjectId[],
    hostelDetails?: any[],
    categoryId?: mongoose.Types.ObjectId,
    createdBy?: mongoose.Types.ObjectId,
  ): Promise<string> => {
    try {
      const currentDate = new Date();
      currentDate.setUTCHours(0, 0, 0, 0);

      // Step 1: Validate staff by email and phone
      await this.validateSatff({ email, phone, userName });

      // Step 2: Hash the password
      const hashedPassword = await hashPassword("123456789");

      const dobDate = new Date(dob);
      dobDate.setUTCHours(0, 0, 0, 0);

      const joiningDateNew = new Date(joiningDate);
      joiningDateNew.setUTCHours(0, 0, 0, 0);

      // Step 3: Extract hostelIds from hostelDetails if categoryId is provided
      let hostelIds = assignedHostelIds ?? [];
      if (categoryId && hostelDetails?.length) {
        const extractedHostelIds = hostelDetails
          .map((hostel) => hostel.hostelId)
          .filter(Boolean);
        hostelIds = [...new Set([...hostelIds, ...extractedHostelIds])]; // Remove duplicates
      }

      // Step 4: Create the new user object
      await Staff.create({
        name,
        userName,
        image,
        email,
        phone,
        dob: dobDate,
        gender,
        bloodGroup,
        password: hashedPassword,
        roleId,
        hostelIds, // Updated hostelIds
        hostelDetails,
        vechicleDetails: vechicles,
        kycDocuments,
        joiningDate: joiningDateNew,
        fatherName,
        motherName,
        spouseName,
        shiftStartTime: shiftStartTime ?? null,
        shiftEndTime: shiftEndTime ?? null,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
        categoryId: categoryId ?? null,
        createdBy,
      });

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get all staff
  staffWithPagination = async (
    page: number,
    limit: number,
    filterStatus: UserGetByTypes,
    search?: string,
    roles?: string,
    hostelId?: string,
    dateRange?: ReportDropDownTypes,
  ): Promise<{
    staffs: any[];
    counts: {
      allUserCount: number;
      activeUserCount: number;
      inactiveUserCount: number;
      newUserCount: number;
    };
  }> => {
    try {
      const skip = (page - 1) * limit;
      const searchAsNumber = !isNaN(Number(search)) ? Number(search) : null;

      // Build search parameters
      const searchParams = search
        ? {
            $or: [
              { name: { $regex: `^${search}`, $options: "i" } },
              { email: { $regex: `^${search}`, $options: "i" } },
              ...(searchAsNumber ? [{ phone: searchAsNumber }] : []),
            ],
          }
        : {};

      const statusParams: any = {};
      // Set status based on the status
      if (filterStatus === UserGetByTypes.ACTIVE) {
        statusParams.status = true;
      } else if (filterStatus === UserGetByTypes.INACTIVE) {
        statusParams.status = false;
      } else if (filterStatus === UserGetByTypes.LEFT_USER) {
        statusParams.status = false;
      } else if (filterStatus === UserGetByTypes.ALL) {
        // Do nothing; this includes all
      } else if (filterStatus === UserGetByTypes.NEW) {
        // Get the current date and calculate the date 1 year ago
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        // Filter users joined within the last year
        statusParams.joiningDate = { $gte: oneYearAgo };
      } else {
        throw new Error(INVALID_STATUS);
      }

      // Build role query
      const searchRoleQuery = roles
        ? {
            roleId: {
              $in: roles.includes(",")
                ? roles
                    .split(",")
                    .map((role) =>
                      mongoose.isValidObjectId(role.trim())
                        ? role.trim()
                        : null,
                    )
                    .filter(Boolean)
                : [mongoose.isValidObjectId(roles) ? roles.trim() : null],
            },
          }
        : {};

      // Build hostel filter
      const hostelFilter = hostelId ? { hostelIds: { $in: [hostelId] } } : {};

      // Get date range from dateRange
      const dateparams: any = {};
      if (dateRange) {
        const { start, end } = getDateRange(dateRange);
        if (start && end) {
          dateparams.joiningDate = {
            $gte: new Date(start),
            $lte: new Date(end),
          };
        }
      }

      // Combine all filters
      const filter = {
        ...searchParams,
        ...searchRoleQuery,
        ...hostelFilter,
        ...statusParams,
        ...dateparams,
      };

      // Combine all filters
      const filterCount = {
        ...searchParams,
        ...searchRoleQuery,
        ...hostelFilter,
        ...dateparams,
      };

      // Get the current date and calculate the date 1 year ago
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Execute count and find in parallel
      const [
        allUserCount,
        activeUserCount,
        inactiveUserCount,
        newUserCount,
        staffs,
      ] = await Promise.all([
        Staff.countDocuments(filterCount),
        Staff.countDocuments({ ...filterCount, status: true }),
        Staff.countDocuments({ ...filterCount, status: false }),
        Staff.countDocuments({
          joiningDate: { $gte: oneYearAgo },
          ...filterCount,
        }),
        Staff.find(filter)
          .populate([
            { path: "roleId", select: "name" },
            { path: "createdBy", select: "name" },
            { path: "categoryId", select: "name" },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select("-password"),
      ]);
      // Fetch room details and map the staff data
      const result = await Promise.all(
        staffs.map(async (ele) => {
          return {
            _id: ele._id,
            category: ele?.categoryId ?? null,
            name: ele?.name ?? null,
            image: ele?.image ?? null,
            email: ele?.email ?? null,
            phone: ele?.phone ?? null,
            gender: ele?.gender ?? null,
            userName: ele?.userName ?? null,
            role: (ele.roleId as any)?.name ?? null,
            isHostelAssigned: !!ele.hostelIds?.length,
            canAssignHostel: true,
            joiningDate: ele?.joiningDate ?? null,
            status: ele?.status ?? null,
            createdBy: (ele?.createdBy as any)?.name ?? null,
            createdAt: ele?.createdAt ?? null,
          };
        }),
      );

      return {
        staffs: result,
        counts: {
          allUserCount,
          activeUserCount,
          inactiveUserCount,
          newUserCount,
        },
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get staff by id
  async getStaffById(id: string): Promise<{ staff: any }> {
    try {
      const staff: any = await Staff.findById(id)
        .populate([
          { path: "hostelIds", select: "name" },
          { path: "categoryId", select: "name" },
          { path: "roleId", select: "name" },
          { path: "hostelDetails.hostelId", select: "name" }, // Populate hostelDetails.hostelId
        ])
        .select("-password")
        .lean();

      // Ensure image is neither null nor undefined
      if (staff?.image && staff.image.trim() !== "") {
        staff.image = await getSignedUrl(staff.image);
      }

      // Process KYC documents
      const kycDocuments = [
        "aadhaarCard",
        "drivingLicense",
        "panCard",
        "passport",
        "voterCard",
      ];

      if (staff?.kycDocuments) {
        for (const doc of kycDocuments) {
          staff.kycDocuments[doc] =
            staff?.kycDocuments[doc] && staff?.kycDocuments[doc].trim() !== ""
              ? await getSignedUrl(staff?.kycDocuments[doc])
              : null;
        }
      }

      const result = {
        ...staff,
        isHostelAssigned: staff?.hostelIds.length > 0,
      };

      return { staff: result };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to assign hostel to warden
  async assignHostelToWarden(
    hostelIds: string[],
    staffId: string,
  ): Promise<string> {
    try {
      const userId = new mongoose.Types.ObjectId(staffId);

      // Validate hostel existence
      const hostels: any = await Hostel.find({ _id: { $in: hostelIds } });
      if (hostels.length !== hostelIds.length)
        throw new Error(RECORD_NOT_FOUND("One or more Hostels"));

      // Assign hostelIds to the staff
      await Staff.findByIdAndUpdate(userId, {
        $set: { hostelIds },
      });

      // Update the wardenIds in the hostels
      await Promise.all(
        hostels.map(async (hostel: any) => {
          // Check if the staffId already exists in wardenIds
          if (!hostel.wardenIds.includes(userId)) {
            await Hostel.findByIdAndUpdate(hostel._id, {
              $push: { wardenIds: userId },
            });
          }
        }),
      );

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get assigned hostel of warden
  hostelForWarden = async (
    staffId: mongoose.Types.ObjectId,
    hostelId?: string,
  ): Promise<{ hostels: any[] }> => {
    try {
      const [staffWithHostels] = await Staff.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(staffId) } },
        {
          $lookup: {
            from: "hostels",
            localField: "hostelIds",
            foreignField: "_id",
            as: "hostels",
            pipeline: [
              {
                $project: {
                  name: 1,
                  address: 1,
                  buildingNumber: 1,
                  activeHostel: {
                    $cond: {
                      if: hostelId
                        ? {
                            $eq: [
                              "$_id",
                              new mongoose.Types.ObjectId(hostelId),
                            ],
                          }
                        : false,
                      then: true,
                      else: false,
                    },
                  },
                },
              },
            ],
          },
        },
        { $project: { hostels: 1 } },
      ]);

      return { hostels: staffWithHostels?.hostels ?? [] };
    } catch (error: any) {
      throw new Error(`Failed to retrieve hostels: ${error.message}`);
    }
  };

  //SECTION: Method to delete staff by id
  deleteStaffById = async (id: string): Promise<string> => {
    try {
      const deletData = await Staff.findByIdAndDelete(id);

      if (!deletData) throw new Error(RECORD_NOT_FOUND("Staff"));

      return DELETE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to inactive staff by id
  inactiveStaffById = async (
    staffId: string,
    updatedById: string,
  ): Promise<string> => {
    try {
      // NOTE - Find the staff by ID
      const staff = await Staff.findById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // NOTE - Toggle the status
      const newStatus = !staff.status;

      // NOTE - Update the staff status
      await Staff.findByIdAndUpdate(staffId, {
        $set: { status: newStatus, updatedBy: updatedById },
      });

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to update a staff by id
  updateNewStaffById = async (
    id: string,
    roleId: mongoose.Types.ObjectId,
    name: string,
    userName: string,
    image: string,
    email: string,
    phone: number,
    dob: Date,
    bloodGroup: BloodGroupType,
    joiningDate: Date,
    gender: Gender,
    fatherName: string,
    motherName: string,
    spouseName: string,
    shiftStartTime: string,
    shiftEndTime: string,
    vechicles: any,
    kycDocuments: any,
    status?: boolean,
    assignedHostelIds?: mongoose.Types.ObjectId[],
    hostelDetails?: any[],
    categoryId?: mongoose.Types.ObjectId,
    updatedById?: mongoose.Types.ObjectId,
  ): Promise<string> => {
    try {
      const currentDate = new Date();
      currentDate.setUTCHours(0, 0, 0, 0);

      // Check if the staff exists with the provided id
      const existingStaff: any = await Staff.findById(id);

      // If not found, throw an error
      if (!existingStaff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Check if email, phone, or username already exists for another staff member
      if (email || phone || userName) {
        const query: any = {
          _id: { $ne: id },
          $or: [{ email }, { phone }, { userName }],
        };

        const duplicateStaff = await Staff.findOne(query);
        if (duplicateStaff) {
          if (
            duplicateStaff.email === email &&
            duplicateStaff.phone === phone &&
            duplicateStaff.userName === userName
          ) {
            throw new Error(DUPLICATE_RECORD("email, phone, and userName."));
          } else if (duplicateStaff.email === email) {
            throw new Error(DUPLICATE_RECORD("Email"));
          } else if (duplicateStaff.phone === phone) {
            throw new Error(DUPLICATE_RECORD("Phone"));
          } else if (duplicateStaff.userName === userName) {
            throw new Error(DUPLICATE_RECORD("User Name"));
          }
        }
      }

      const dobDate = new Date(dob);
      dobDate.setUTCHours(0, 0, 0, 0);

      const joiningDateNew = new Date(joiningDate);
      joiningDateNew.setUTCHours(0, 0, 0, 0);

      // Step 3: Extract hostelIds from hostelDetails if categoryId is provided
      let hostelIds = assignedHostelIds ?? [];
      if (categoryId && hostelDetails?.length) {
        const extractedHostelIds = hostelDetails
          .map((hostel) => hostel.hostelId)
          .filter(Boolean);
        hostelIds = [...new Set([...hostelIds, ...extractedHostelIds])]; // Remove duplicates
      }

      let payload: any = {
        name,
        userName,
        image,
        email,
        phone,
        dob: dobDate,
        gender,
        bloodGroup,
        roleId,
        hostelIds,
        hostelDetails,
        vechicleDetails: vechicles,
        kycDocuments,
        joiningDate: joiningDateNew,
        fatherName,
        motherName,
        spouseName,
        shiftStartTime: shiftStartTime ?? null,
        shiftEndTime: shiftEndTime ?? null,
        updatedBy: updatedById,
        status: status ?? true,
        categoryId: categoryId ?? null,
        updatedAt: getCurrentISTTime(),
      };

      // Handle image if signed url
      if (image && image.includes("amazonaws.com")) {
        payload.image = existingStaff?.image;
      } else {
        if (existingStaff?.image) {
          const existingImageKey = existingStaff.image;
          await deleteFromS3(
            process.env.S3_BUCKET_NAME ?? "yoco-staging",
            existingImageKey,
          );
        }
        payload.image = image;
      }

      // Process kycDocuments for updates or retention of existing S3 URLs
      for (const [docType, docUrl] of Object.entries(kycDocuments)) {
        if (typeof docUrl === "string") {
          if (docUrl.includes("amazonaws.com")) {
            // Retain existing URL if it's a signed S3 URL
            payload.kycDocuments[docType] = existingStaff.kycDocuments[docType];
          } else {
            // Delete the existing document from S3 if there's a new upload
            if (
              existingStaff.kycDocuments &&
              existingStaff.kycDocuments[docType]
            ) {
              await deleteFromS3(
                process.env.S3_BUCKET_NAME ?? "yoco-staging",
                existingStaff.kycDocuments[docType],
              );
            }
            // Assign new document URL to payload
            payload.kycDocuments[docType] = docUrl;
          }
        } else {
          console.warn(
            `Invalid document URL type for ${docType}, expected string.`,
          );
        }
      }

      await Staff.findByIdAndUpdate(existingStaff._id, {
        $set: payload,
      });

      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(`Failed to update staff: ${error.message}`);
    }
  };

  //SECTION: Method to get all maintance staff
  async maintanceStaffs(
    compaintId: string,
    categoryType: ComplaintTypes,
    hostelId: string,
  ): Promise<{ staffs: any[] }> {
    try {
      //NOTE - get complain details by id
      const compaint = await Complaint.findById(compaintId);
      if (!compaint) throw new Error(RECORD_NOT_FOUND("Complaint"));

      // Get the Maintenance role case-insensitively
      const roles = await Role.find({ categoryType }).lean();

      if (!roles.length) throw new Error(RECORD_NOT_FOUND("Role"));

      // Extract role IDs
      const roleIds = roles.map((role) => role._id);

      const hostelObjectId = new mongoose.Types.ObjectId(hostelId);

      // Find staff matching the role and category
      const staffs = await Staff.find({
        roleId: { $in: roleIds },
        categoryId: compaint?.categoryId,
        hostelIds: { $in: [hostelObjectId] },
      }).select("name userName phone image");

      if (!staffs.length) {
        return { staffs: [] };
      }

      const formattedStaffs = await Promise.all(
        staffs.map(async (staff) => ({
          _id: staff._id,
          name: staff.name,
          userName: staff.userName,
          phone: staff.phone,
          image: staff.image ? await getSignedUrl(staff.image) : null,
        })),
      );

      return { staffs: formattedStaffs ?? [] };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to check if the staff id warden or admin
  async checkStaffRole(staffId: string): Promise<{ isWarden: boolean }> {
    try {
      // Get staff details by ID
      const staff = await Staff.findById(staffId).select("roleId");
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Get the Warden role
      const { role } = await getRoleByName("warden");
      if (!role) throw new Error(RECORD_NOT_FOUND("warden role"));

      // Check if the staff's roleId matches the warden role's _id
      const isWarden = staff.roleId.toString() === role._id.toString();

      return { isWarden };
    } catch (error: any) {
      throw new Error(`Failed to retrieve staff role: ${error.message}`);
    }
  }

  //SECTION: Method to get staff by email
  async staffByEmailId(email: string): Promise<{ staff: any }> {
    try {
      const staff = await Staff.findOne({ email }).select("name");

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      return { staff };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get staff by email or phone (identifier)
  async getStaffByIdentifier(
    identifier: string,
  ): Promise<{ staff: any; isEmail: boolean }> {
    try {
      // Determine if identifier is email or phone
      const isEmail = String(identifier).includes("@");

      // Build query based on identifier type
      const query = isEmail
        ? { email: String(identifier).trim() }
        : { phone: Number(identifier) };

      const staff = await Staff.findOne(query).select("name phone email _id");

      if (!staff) {
        throw new Error(
          RECORD_NOT_FOUND(
            isEmail ? "Staff with this email" : "Staff with this phone",
          ),
        );
      }

      return { staff, isEmail };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get staff in warden or admin panel
  staffDetailsByType = async (
    staffId: mongoose.Types.ObjectId,
    type: FetchUserTypes,
  ): Promise<{ details: any }> => {
    try {
      // Check if the staff exists
      const staffExists = await Staff.exists({ _id: staffId });
      if (!staffExists) throw new Error(RECORD_NOT_FOUND("User"));

      // Fetch user details
      const checkUser: any = await Staff.findOne({ _id: staffId }).populate([
        { path: "hostelIds", select: "name" },
        { path: "roleId", select: "name" },
        { path: "categoryId", select: "name" },
      ]);

      // Fetch hostel allocation details
      const userHostelDetails: any = await StaffHostelAllocation.findOne({
        staffId: checkUser._id,
        status: true,
      })
        .select("hostelId bedType roomNumber bedNumber floorNumber")
        .populate([{ path: "hostelId", select: "name" }]);

      const baseResponse = {
        _id: checkUser._id,
        name: checkUser?.name ?? null,
        email: checkUser?.email ?? null,
        phone: checkUser?.phone ?? null,
        userName: checkUser?.userName ?? null,
        shiftStartTime: checkUser?.shiftStartTime ?? null,
        shiftEndTime: checkUser?.shiftEndTime ?? null,
        image: checkUser?.image ? await getSignedUrl(checkUser.image) : null,
      };

      let response;

      switch (type) {
        case FetchUserTypes.HOSTEL:
          // Get roommates in the same hostel and room
          const roomMates = await StaffHostelAllocation.find({
            staffId: { $ne: checkUser._id },
            hostelId: userHostelDetails?.hostelId._id,
            roomNumber: userHostelDetails?.roomNumber,
          }).select("studentId roomNumber bedNumber");

          // Extract staff to batch fetch users
          const staffIds = roomMates.map((mate: any) => mate?.studentId);

          // Fetch user details in one query
          const users = await Staff.find({
            _id: { $in: staffIds },
            uniqueId: { $ne: null },
          }).select("name email phone image userName");

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
                  userName: user.userName ?? null,
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
            hostelId: userHostelDetails?.hostelId._id ?? null,
            hostelName: userHostelDetails?.hostelId?.name ?? null,
            bedType: userHostelDetails?.bedType ?? null,
            roomNumber: userHostelDetails?.roomNumber ?? null,
            bedNumber: userHostelDetails?.bedNumber ?? null,
            floorNumber: userHostelDetails?.floorNumber ?? null,
            roomMatesData: filteredRoomMatesData,
          };
          break;

        case FetchUserTypes.FAMILY:
          response = {
            ...baseResponse,
            bloodGroup: checkUser?.bloodGroup ?? null,
            dob: checkUser?.dob ?? null,
            fatherName: checkUser?.fatherName ?? null,
            motherName: checkUser?.motherName ?? null,
            spouseName: checkUser?.spouseName ?? null,
            role: checkUser?.roleId?.name ?? null,
            category: checkUser?.categoryId?.name ?? null,
          };
          break;

        case FetchUserTypes.KYC:
          response = {
            ...baseResponse,
            kycDocuments: {
              aadhaarCard: checkUser?.kycDocuments?.aadhaarCard
                ? await getSignedUrl(checkUser.kycDocuments.aadhaarCard)
                : null,
              passport: checkUser?.kycDocuments?.passport
                ? await getSignedUrl(checkUser.kycDocuments.passport)
                : null,
              voterCard: checkUser?.kycDocuments?.voterCard
                ? await getSignedUrl(checkUser.kycDocuments.voterCard)
                : null,
              drivingLicense: checkUser?.kycDocuments?.drivingLicense
                ? await getSignedUrl(checkUser.kycDocuments.drivingLicense)
                : null,
              panCard: checkUser?.kycDocuments?.panCard
                ? await getSignedUrl(checkUser.kycDocuments.panCard)
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
          const indisciplinaryActions = await StaffIndisciplinaryAction.find({
            staffId: checkUser._id,
          }).select("staffId remark isFine fineAmount createdAt");
          response = { ...baseResponse, indisciplinaryActions };
          break;

        default:
          throw new Error(`Invalid user type: ${type}`);
      }

      return { details: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to upload indisciplinary Action of staff
  staffIndisciplinaryAction = async (
    staffId: string,
    remark: string,
    isFine: boolean,
    fineAmount: number,
    userId?: string,
  ): Promise<string> => {
    try {
      //NOTE - Check staff
      const staff = await Staff.exists({ _id: staffId });

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      //NOTE - update staff
      await Staff.findByIdAndUpdate(staffId, {
        $set: { indisciplinaryAction: true },
      });

      //NOTE - create indisciplinary action for staff
      await StaffIndisciplinaryAction.create({
        staffId,
        reportedBy: userId,
        remark,
        isFine,
        fineAmount,
        createdBy: userId,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });
      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to fetch All Staff For Warden new
  fetchAllStaffForWarden = async (
    page: number,
    limit: number,
    hostelId: string,
    filterStatus: UserGetByTypes,
    role: string,
    search?: string,
  ): Promise<{
    staffs: any[];
    count: number;
  }> => {
    try {
      const skip = (page - 1) * limit;
      const searchAsNumber = !isNaN(Number(search)) ? Number(search) : null;

      // Build search parameters
      const searchParams = search
        ? {
            $or: [
              { name: { $regex: `^${search}`, $options: "i" } },
              { email: { $regex: `^${search}`, $options: "i" } },
              ...(searchAsNumber ? [{ phone: searchAsNumber }] : []),
            ],
          }
        : {};

      // Build hostel filter
      const hostelFilter = hostelId ? { hostelIds: { $in: [hostelId] } } : {};

      const statusParams: any = {};
      // Set status based on the status
      if (filterStatus === UserGetByTypes.ACTIVE) {
        statusParams.status = true;
      } else if (filterStatus === UserGetByTypes.INACTIVE) {
        statusParams.status = false;
      } else if (filterStatus === UserGetByTypes.LEFT_USER) {
        statusParams.status = false;
      } else if (filterStatus === UserGetByTypes.NEW) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        statusParams.joiningDate = { $gte: oneYearAgo };
      } else if (filterStatus !== UserGetByTypes.ALL) {
        throw new Error(INVALID_STATUS);
      }

      // Get roles based on the specified `role`
      let roleFilter: any = {};
      if (role) {
        if (role.toLowerCase() === "admin") {
          const adminRole = await Role.find({
            $and: [
              { name: { $regex: /admin/i } },
              { name: { $not: { $regex: /super admin/i } } },
            ],
          });
          if (adminRole.length > 0) {
            roleFilter.roleId = { $in: adminRole.map((r) => r._id) };
          }
        } else if (role.toLowerCase() === "staff") {
          const staffRoles = await Role.find({
            name: { $regex: /^(?!.*(?:admin|super\s?admin)).*$/i },
          }).select("_id");
          if (staffRoles.length > 0) {
            roleFilter.roleId = { $in: staffRoles.map((r) => r._id) };
          }
        }
      }

      // Combine all filters
      const filter = {
        ...searchParams,
        ...statusParams,
        ...roleFilter,
        ...hostelFilter,
      };

      // Get the current date and calculate the date 1 year ago
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Execute count and find in parallel
      const [count, staffs] = await Promise.all([
        Staff.countDocuments({
          ...filter,
        }),
        Staff.find(filter)
          .populate([
            { path: "roleId", select: "name" },
            { path: "createdBy", select: "name" },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select("-password"),
      ]);

      // Fetch room details and map the staff data
      const result = await Promise.all(
        staffs.map(async (ele) => {
          return {
            _id: ele._id,
            name: ele?.name ?? null,
            image: ele.image ? await getSignedUrl(ele.image) : null,
            email: ele?.email ?? null,
            phone: ele?.phone ?? null,
            userName: ele?.userName ?? null,
            roleId: ele?.roleId?._id ?? null,
            role: (ele.roleId as any)?.name ?? null,
            status: ele?.status ?? null,
          };
        }),
      );

      return { staffs: result, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to fetch Payment Options By Hostel
  fetchStaffActiveHostelDetails = async (
    hostelId: string,
  ): Promise<{ details: any }> => {
    try {
      const result = await Hostel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(hostelId) } },
        {
          $lookup: {
            from: "colleges",
            localField: "universityId",
            foreignField: "_id",
            as: "university",
          },
        },
        { $unwind: { path: "$university", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "courses",
            localField: "university.courseIds",
            foreignField: "_id",
            as: "courses",
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            university: {
              _id: "$university._id",
              name: "$university.name",
            },
            courses: { _id: 1, name: 1 },
          },
        },
      ]);

      if (!result || result.length === 0)
        throw new Error(RECORD_NOT_FOUND("Hostel, University, or Courses"));

      return { details: result[0] };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION - Method to check username exists or not in staff
  async checkUsernameExists(
    userName: string,
  ): Promise<{ isUserNameExist: boolean }> {
    const staff: any = await Staff.exists({
      userName: { $regex: new RegExp(`^${userName}$`, "i") },
    });
    return { isUserNameExist: !!staff };
  }

  // SECTION: Method to check if staff exists and return _id and name if found
  async getStaffExistById(
    staffId: string,
  ): Promise<{ exists: boolean; staff: any }> {
    try {
      // Query for staff with only _id and name fields
      const staff = await Staff.exists({ _id: staffId }).lean();

      // If no staff is found, return `exists: false`
      if (!staff) {
        return { exists: false, staff: null };
      }

      // If found, return `exists: true` along with the staff's _id and name
      return { exists: true, staff };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  // ANCHOR - validate Staff With Email And Phone
  validateSatff = async ({
    email,
    phone,
    userName,
  }: {
    email: string;
    phone: number;
    userName: string;
  }): Promise<boolean> => {
    // NOTE - check if a user exists with the same email, phone, or username
    const checkUser = await Staff.findOne({
      $or: [{ email }, { phone }, { userName }],
    });

    if (checkUser) {
      if (checkUser.email === email && checkUser.phone === phone) {
        throw new Error(ALREADY_EXIST_FIELD_TWO("Email", "Phone"));
      } else if (checkUser.email === email) {
        throw new Error(ALREADY_EXIST_FIELD_ONE("Email"));
      } else if (checkUser.phone === phone) {
        throw new Error(ALREADY_EXIST_FIELD_ONE("Phone"));
      } else if (checkUser.userName === userName) {
        throw new Error(ALREADY_EXIST_FIELD_ONE("User Name"));
      }
    }
    return true;
  };
}

export default new StaffService();
