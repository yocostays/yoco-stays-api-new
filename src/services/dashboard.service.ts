import mongoose from "mongoose";
import Staff from "../models/staff.model";
import StudentLeave from "../models/student-leave.model";
import Complain from "../models/complaint.model";
import User from "../models/user.model";
import { VALIDATION_MESSAGES } from "../utils/messages";
import { ComplainStatusTypes, LeaveStatusTypes } from "../utils/enum";

const { STAFF_ROLE_INVALID } = VALIDATION_MESSAGES;

class DashboardService {
  //SECTION: Method to get warden Dashboard Details
  async wardenDashboardData(
    hostelId: mongoose.Types.ObjectId,
    createdById: mongoose.Types.ObjectId
  ): Promise<{ result: any }> {
    try {
      //NOTE - get staff details
      const [staffWithRole] = await Staff.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(createdById) } },
        {
          $lookup: {
            from: "roles",
            localField: "roleId",
            foreignField: "_id",
            as: "roleDetails",
          },
        },
        { $unwind: { path: "$roleDetails", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            "roleDetails.name": { $regex: /warden/i },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            roleId: 1,
            role: "$roleDetails.name",
          },
        },
      ]);

      if (!staffWithRole) throw new Error(STAFF_ROLE_INVALID);

      //NOTE - get users baased on the hostelId
      const noOfUser = await User.countDocuments({ hostelId });
      const activeUserCount = await User.countDocuments({
        hostelId,
        isVerified: true,
      });

      const allDetails = {
        staffId: staffWithRole._id,
        hostelId,
        noOfUser,
        activeUserCount,
      };

      return { result: allDetails };
    } catch (error: any) {
      throw new Error(`Failed to get dashboard details: ${error.message}`);
    }
  }

  //SECTION: Method to get user Dashboard Details
  async userDashboardData(
    userId: mongoose.Types.ObjectId
  ): Promise<{ result: any }> {
    try {
      //NOTE - user complain count
      const complainCount = await Complain.countDocuments({
        userId,
        complainStatus: { $ne: ComplainStatusTypes.CANCELLED },
      });

      //NOTE - user leave count
      const leaveCount = await StudentLeave.countDocuments({
        userId,
        leaveStatus: { $ne: LeaveStatusTypes.CANCELLED },
      });

      const allDetails = {
        complainCount,
        leaveCount,
        eventCount: 0,
        announcement: 0,
      };

      return { result: allDetails };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
}

export default new DashboardService();
