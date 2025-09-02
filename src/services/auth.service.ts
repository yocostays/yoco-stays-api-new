import mongoose from "mongoose";
import Staff from "../models/staff.model";
import User from "../models/user.model";
import Otp from "../models/otp.model";
import Token from "../models/token.model";
import { AccountType, BulkUploadTypes, LoginType } from "../utils/enum";
import { comparePassword, hashPassword } from "../utils/hashUtils";
import { generateExpiryTime, getCurrentISTTime } from "../utils/lib";
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";
import { generateToken } from "../utils/tokenUtils";
import {
  getSignedUrl,
  uploadFileToCloudStorage,
} from "../utils/awsUploadService";
import { generateSecureOtp, getExpiryDate } from "../utils/otpService";
import { sendSMS } from "../utils/commonService/messagingService";

const { USER_LOGOUT_SUCCESS, PASSWORD_RESET_SUCCESS } = SUCCESS_MESSAGES;
const {
  RECORD_NOT_FOUND,
  IMAGE_UPLOAD_ERROR,
  PASSWROD_RESET_ISSUES,
  OTP_EXPIRED,
  OTP_NOT_VERIFIED,
  SIGNED_URL,
  INACTIVE_USER,
  OTP_NOT_FOUND,
  OTP_NOT_FOUND_With_PHONE,
} = ERROR_MESSAGES;
const { INVALID_PASSWORD } = VALIDATION_MESSAGES;

class AuthService {
  //SECTION: Method to login a staff
  staffLoginWithUserNameAndPwd = async (
    userName: string,
    password: string
  ): Promise<{ staff: any; token: string }> => {
    try {
      // Step 1: Get staff based on the user name
      const staff = await Staff.findOne({ userName })
        .populate([{ path: "roleId", select: "name" }])
        .lean();

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      if (staff.status === false) throw new Error(INACTIVE_USER);

      // Step 2: Compare the password with the hashed password
      const isPasswordValid = await comparePassword(password, staff.password);
      if (!isPasswordValid) {
        throw new Error(INVALID_PASSWORD);
      }

      // Step 3: Generate a JWT token
      const tokenString = generateToken(
        {
          _id: staff?._id,
          userName: staff?.userName,
          role: staff?.roleId,
          hostelId: staff?.hostelIds[0] ?? null,
          accountType: AccountType.STAFF,
        },
        { expiresIn: "48h" }
      );

      // Step 4: Generate expiry time using the utility function
      const expiryTime = generateExpiryTime(48); // Set for 24 hours // 24 hours from now
      const existingToken = await Token.findOne({ userId: staff._id });

      if (existingToken) {
        // Update existing token
        existingToken.token = tokenString;
        existingToken.expiryTime = expiryTime;
        await existingToken.save();
      } else {
        // Create a new token
        const newToken = new Token({
          accountType: AccountType.STAFF,
          userId: staff._id,
          token: tokenString,
          expiryTime: expiryTime,
          status: true,
        });
        await newToken.save();
      }

      // Step 5: Return staff details and token
      return { staff, token: tokenString };
    } catch (error: any) {
      throw new Error(`Login failed: ${error.message}`);
    }
  };

  //SECTION: Method to login a student
  studentLogin = async (
    uniqueId: string,
    password: string,
    rememberMe: boolean,
    loginType: LoginType,
    subscriptionId: string
  ): Promise<{ student: any; token: string }> => {
    try {
      // Step 1: Get student based on the user name
      const student = await User.findOne({ uniqueId })
        .select("name hostelId image phone email password")
        .populate([{ path: "hostelId", select: "name" }])
        .lean();

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      if (student.status === false) throw new Error(INACTIVE_USER);

      // Step 2: Compare the password with the hashed password
      const isPasswordValid = await comparePassword(
        password,
        student?.password
      );
      if (!isPasswordValid) throw new Error(INVALID_PASSWORD);

      // Step 3: Set token expiration based on rememberMe
      const tokenExpiry = rememberMe ? "180d" : "48h"; // '6m' = 6 months, '48h' = 48 hours

      // Step 4: Generate a JWT token
      const tokenString = generateToken(
        {
          _id: student._id,
          uniqueId: student.uniqueId,
          role: student.roleId,
          accountType: AccountType.STUDENT,
        },
        { expiresIn: tokenExpiry }
      );

      // Step 5: Generate expiry time using the utility function
      const expiryTime = generateExpiryTime(rememberMe ? 4320 : 48); // 4320 hours for 6 months, 48 hours otherwise

      const existingToken = await Token.findOne({ userId: student._id });

      if (existingToken) {
        // Update existing token
        existingToken.token = tokenString;
        existingToken.expiryTime = expiryTime;
        await existingToken.save();
      } else {
        // Create a new token
        const newToken = new Token({
          accountType: AccountType.STUDENT,
          userId: student._id,
          token: tokenString,
          expiryTime: expiryTime,
          status: true,
        });
        await newToken.save();
      }

      const updateData: any = { lastLogin: getCurrentISTTime() };
      switch (loginType) {
        case LoginType.WEB:
          updateData.oneSignalWebId = subscriptionId;
          break;
        case LoginType.ANDORID:
          updateData.oneSignalAndoridId = subscriptionId;
          break;
        case LoginType.IOS:
          updateData.oneSignalIosId = subscriptionId;
          break;
      }

      await User.findByIdAndUpdate(student._id, { $set: updateData });

      // Step 6: Return student details and token
      return { student, token: tokenString };
    } catch (error: any) {
      throw new Error(`Login failed: ${error.message}`);
    }
  };

  //SECTION: Method to logout a student
  logoutCurrentUser = async (userId: string): Promise<string> => {
    try {
      //NOTE: Add 5 hours and 30 minutes to the current date and time
      const currentDate = new Date();
      currentDate.setHours(
        currentDate.getHours() + 5,
        currentDate.getMinutes() + 30
      );

      //get token by userId
      const token = await Token.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId) },
        { $set: { expiryTime: currentDate } }
      );

      if (!token) {
        throw new Error(RECORD_NOT_FOUND("Token"));
      }
      return USER_LOGOUT_SUCCESS;
    } catch (error: any) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  };

  //SECTION: Method to generate Otp
  generateOtp = async (
    userId: string,
    phone: string
  ): Promise<{ otp: number }> => {
    try {
      const otp = generateSecureOtp();
      const expiryTime = getExpiryDate(5, "M");

      // Upsert OTP document for the user
      await Otp.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId) },
        {
          otp,
          expiryTime,
          isVerified: false,
          status: true,
          updatedBy: userId,
        },
        { upsert: true, new: true }
      );

      //NOTE: Send otp to the User.
      await sendSMS(phone, otp);
      return { otp };
    } catch (error: any) {
      throw new Error(`User OTP geenerate: ${error.message}`);
    }
  };

  //SECTION: Method to reset student password
  resetStudentPassword = async (
    userId: string,
    password: string,
    otp: number
  ): Promise<string> => {
    try {
      const currentDate = new Date();

      //NOTE - find otp
      const existingOtp: any = await Otp.findOne({
        userId,
        otp,
      });

      if (!existingOtp) throw new Error(OTP_NOT_VERIFIED);

      const expiryTimeDate = new Date(existingOtp.expiryTime);

      if (expiryTimeDate <= currentDate || existingOtp.isVerified)
        throw new Error(OTP_EXPIRED);

      //NOTE: otp verifed sucessfully
      await Otp.findByIdAndUpdate(existingOtp._id, {
        $set: { status: false, isVerified: true },
      });

      // Step 2: Hash the password
      const hashedPassword = await hashPassword(password);

      //reset user password
      const reset = await User.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { password: hashedPassword, updatedAt: getCurrentISTTime() } }
      );

      if (!reset) throw new Error(PASSWROD_RESET_ISSUES);

      return PASSWORD_RESET_SUCCESS;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to reset staff password
  resetStaffPassword = async (
    userId: string,
    password: string,
    otp: number
  ): Promise<string> => {
    try {
      const currentDate = new Date();

      //NOTE - find otp
      const existingOtp: any = await Otp.findOne({
        userId,
        otp,
      });

      if (!existingOtp) throw new Error(OTP_NOT_VERIFIED);

      const expiryTimeDate = new Date(existingOtp.expiryTime);

      if (expiryTimeDate <= currentDate || existingOtp.isVerified)
        throw new Error(OTP_EXPIRED);

      //NOTE: otp verifed sucessfully
      await Otp.findByIdAndUpdate(existingOtp._id, {
        $set: { status: false, isVerified: true },
      });

      // Step 2: Hash the password
      const hashedPassword = await hashPassword(password);

      //reset user password
      const reset = await Staff.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { password: hashedPassword, updatedAt: getCurrentISTTime() } }
      );

      if (!reset) throw new Error(PASSWROD_RESET_ISSUES);

      return PASSWORD_RESET_SUCCESS;
    } catch (error: any) {
      throw new Error(`Staff password reset: ${error.message}`);
    }
  };

  //SECTION: Method to reset student password
  uploadFileInApp = async (file: any, folderName: string): Promise<string> => {
    try {
      const url = await uploadFileToCloudStorage(file, folderName);

      if (url && url.Key) {
        const imageKey = url.Key;
        return imageKey;
      } else {
        throw new Error(IMAGE_UPLOAD_ERROR);
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to generate warden Refresh Token
  wardenRefreshToken = async (
    staff: any,
    hostelId: string
  ): Promise<{ token: string }> => {
    try {
      const tokenString = generateToken(
        {
          _id: staff?._id,
          userName: staff?.userName,
          role: staff?.roleId,
          hostelId: hostelId,
          accountType: AccountType.STAFF,
        },
        { expiresIn: "48h" }
      );

      // Step 4: Generate expiry time using the utility function
      const expiryTime = generateExpiryTime(48); // Set for 24 hours // 24 hours from now
      const existingToken = await Token.findOne({ userId: staff._id });

      if (existingToken) {
        // Update existing token
        existingToken.token = tokenString;
        existingToken.expiryTime = expiryTime;
        await existingToken.save();
      } else {
        // Create a new token
        const newToken = new Token({
          accountType: AccountType.STAFF,
          userId: staff._id,
          token: tokenString,
          expiryTime: expiryTime,
          status: true,
        });
        await newToken.save();
      }

      return { token: tokenString };
    } catch (error: any) {
      // Log and throw a meaningful error
      throw new Error(`Error during generate refresh token: ${error.message}`);
    }
  };

  //SECTION: Method to download Sample Bulk Upload File
  downloadSampleBulkUploadFile = async (
    type: BulkUploadTypes
  ): Promise<{ url: string }> => {
    try {
      const originalFile =
        type === BulkUploadTypes.MEAL
          ? process.env.MESS_BULK_UPLOAD_SAMPLE_FILE
          : type === BulkUploadTypes.FOOD_WASTAGE
          ? process.env.FOOD_WASTAGE_BULK_UPLOAD_SAMPLE_FILE
          : type === BulkUploadTypes.HOSTEL_ROOM_MAP
          ? process.env.HOSTEL_ROOM_MAP_BULK_UPLOAD_SAMPLE_FILES
          : process.env.STUDENT_BULK_UPLOAD_SAMPLE_FILE;

      const url = await getSignedUrl(originalFile as string);

      // Check if url is null
      if (!url) throw new Error(SIGNED_URL);

      return { url };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION -  generate Otp on User SignUp
  generateOtpUserSignUp = async (phone: string): Promise<{ otp: number }> => {
    try {
      const otp = generateSecureOtp();
      const expiryTime = getExpiryDate(5, "M");

      // Upsert OTP document for the user
      await Otp.findOneAndUpdate(
        { phone },
        {
          phone,
          otp,
          expiryTime,
          isVerified: false,
          status: true,
        },
        { upsert: true, new: true }
      );

      return { otp };
    } catch (error: any) {
      throw new Error(`OTP generation failed: ${error.message}`);
    }
  };

  //SECTION -  verify Otp on User SignUp
  verifyOtpUserSignUp = async (
    phone: string,
    otp: number
  ): Promise<{ isVerified: boolean }> => {
    try {
      const otpRecord = await Otp.findOne({ phone, isVerified: false }).select(
        "otp expiryTime isVerified"
      );

      if (!otpRecord) throw new Error(OTP_NOT_FOUND_With_PHONE);

      if (otpRecord.otp !== otp) throw new Error(OTP_NOT_FOUND);

      if (new Date() > otpRecord.expiryTime) throw new Error(OTP_EXPIRED);

      otpRecord.isVerified = true;
      await otpRecord.save();

      return { isVerified: true };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };
}

export default new AuthService();
