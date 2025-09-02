import mongoose from "mongoose";
import Complaint from "../models/complaint.model";
import User from "../models/user.model";
import StudentHostelAllocation from "../models/studentHostelAllocation.model";
import {
  ComplainStatusTypes,
  ComplaintTypes,
  ExportTypes,
  ReportDropDownTypes,
  SortingTypes,
} from "../utils/enum";
import { getDateRange } from "../utils/lib";
import { getSignedUrl } from "../utils/awsUploadService";

class MaintenanceReportService {
  //SECTION: Method to get top Maintenance Category List
  topMaintenanceCategoryList = async (
    hostelId: string,
    filter: ReportDropDownTypes,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ report: any }> => {
    try {
      let start: any | undefined, end: any | undefined;

      // If filter is "custom", use startDate and endDate
      if (filter === ReportDropDownTypes.CUSTOM && startDate && endDate) {
        start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);

        end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
      } else {
        ({ start, end } = getDateRange(filter));
      }

      // If hostelId is provided, include it in the query
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

      // Add date range filter
      const dateFilter: any = {};
      if (start && end) {
        dateFilter.createdAt = { $gte: new Date(start), $lte: new Date(end) };
      }

      // Aggregation to find top 5 complaint categories
      const topCategories = await Complaint.aggregate([
        { $match: { ...searchHostel, ...dateFilter } },
        {
          $group: {
            _id: "$categoryId",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "complaincategories",
            localField: "_id",
            foreignField: "_id",
            as: "categoryDetails",
          },
        },
        { $unwind: "$categoryDetails" },
        {
          $project: {
            _id: 0,
            categoryId: "$_id",
            categoryName: "$categoryDetails.name",
            complaintCount: "$count",
          },
        },
      ]);

      return { report: topCategories };
    } catch (error: any) {
      throw new Error(`Failed to get report: ${error.message}`);
    }
  };

  //SECTION: Method to get maintenance Summary
  maintenanceSummary = async (hostelId: string): Promise<{ report: any }> => {
    try {
      // If hostelId is provided, include it in the query
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      // Aggregation to calculate the average resolvedTime for resolved complaints in the last month
      const [averageResolveTime] = await Complaint.aggregate([
        {
          $match: {
            ...searchHostel,
            complainStatus: ComplainStatusTypes.RESOLVED,
            resolvedDate: { $gte: oneMonthAgo },
          },
        },
        {
          $group: {
            _id: null,
            averageResolvedTime: { $avg: "$resolvedTime" },
          },
        },
        {
          $project: {
            _id: 0,
            averageResolvedTime: 1,
          },
        },
      ]);

      // Convert averageResolveTime from minutes to hours and minutes
      const averageResolveTimeMinutes =
        averageResolveTime?.averageResolvedTime ?? 0;
      const hours = Math.floor(averageResolveTimeMinutes / 60);
      const minutes = Math.round(averageResolveTimeMinutes % 60);

      //Aggregate to find the most complained floor number based on user complaints
      const [mostComplainedFloors] = await Complaint.aggregate([
        { $match: { ...searchHostel, createdAt: { $gte: oneMonthAgo } } },
        {
          $lookup: {
            from: "studenthostelallocations",
            localField: "userId",
            foreignField: "studentId",
            as: "allocation",
          },
        },
        { $unwind: { path: "$allocation", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$allocation.floorNumber",
            complaintCount: { $sum: 1 },
          },
        },
        { $sort: { complaintCount: -1 } },
        { $limit: 1 },
        {
          $project: {
            _id: 0,
            floorNumber: "$_id",
            complaintCount: 1,
          },
        },
      ]);

      // Prepare the report
      const report = {
        averageResolveTime: `${hours} hrs ${minutes} mins`,
        mostComplainedFloor: mostComplainedFloors ?? null,
      };
      return { report };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get total Complaint Counts
  totalComplaintCounts = async (
    hostelId: string,
    filter: ReportDropDownTypes,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ counts: any }> => {
    try {
      let start: any | undefined, end: any | undefined;

      // Check if the filter is "custom", then use startDate and endDate
      if (filter === ReportDropDownTypes.CUSTOM && startDate && endDate) {
        const formatedStartDate = new Date(startDate);
        formatedStartDate.setUTCHours(0, 0, 0, 0);

        const formatedEndDate = new Date(endDate);
        formatedEndDate.setUTCHours(23, 59, 59, 999);

        start = formatedStartDate;
        end = formatedEndDate;
      } else {
        ({ start, end } = getDateRange(filter));
      }

      // If hostelId is provided, include it in the query
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

      // Add date range filter
      const dateFilter: any = {};
      if (start && end) {
        dateFilter.createdAt = { $gte: new Date(start), $lte: new Date(end) };
      }

      // Aggregation to get total complaints, pending count, and resolved count
      const complaintStats = await Complaint.aggregate([
        { $match: { ...searchHostel, ...dateFilter } },
        {
          $group: {
            _id: null,
            totalComplaints: { $sum: 1 },
            pendingCount: {
              $sum: {
                $cond: [
                  { $eq: ["$complainStatus", ComplainStatusTypes.PENDING] },
                  1,
                  0,
                ],
              },
            },
            resolvedCount: {
              $sum: {
                $cond: [
                  { $eq: ["$complainStatus", ComplainStatusTypes.RESOLVED] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalComplaints: 1,
            pendingCount: 1,
            resolvedCount: 1,
          },
        },
      ]);

      return {
        counts: complaintStats[0] ?? {
          totalComplaints: 0,
          pendingCount: 0,
          resolvedCount: 0,
        },
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get complaint Resolution Metrics
  complaintResolutionMetrics = async (
    hostelId: string,
    filter: ReportDropDownTypes,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ report: any }> => {
    try {
      let start: any | undefined, end: any | undefined;

      // If filter is "custom", use startDate and endDate
      if (filter === ReportDropDownTypes.CUSTOM && startDate && endDate) {
        start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);

        end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
      } else {
        ({ start, end } = getDateRange(filter));
      }

      // If hostelId is provided, include it in the query
      const searchHostel: any = {};
      if (hostelId) {
        searchHostel.hostelId = new mongoose.Types.ObjectId(hostelId);
      }

      // Date filter
      const dateFilter: any = {};
      if (start && end) {
        dateFilter.createdAt = { $gte: new Date(start), $lte: new Date(end) };
      }

      // Aggregation to get total resolved count and avg resolution time per complaint type
      const resolutionData = await Complaint.aggregate([
        {
          $match: {
            ...searchHostel,
            ...dateFilter,
            complainStatus: ComplainStatusTypes.RESOLVED,
          },
        },
        {
          $group: {
            _id: "$categoryType",
            resolvedCount: { $sum: 1 },
            avgResolutionTime: { $avg: "$resolvedTime" }, // Use resolvedTime directly
          },
        },
        {
          $project: {
            _id: 0,
            categoryType: "$_id",
            resolvedCount: 1,
            avgResolutionTimeInHours: {
              $cond: {
                if: { $gt: ["$avgResolutionTime", 0] },
                then: {
                  $concat: [
                    {
                      $cond: {
                        if: { $gte: ["$avgResolutionTime", 1440] }, // 1440 minutes = 1 day
                        then: {
                          $concat: [
                            {
                              $toString: {
                                $round: [
                                  {
                                    $floor: {
                                      $divide: ["$avgResolutionTime", 1440],
                                    },
                                  },
                                  2,
                                ],
                              },
                            },
                            " day",
                            {
                              $cond: {
                                if: {
                                  $gt: [
                                    {
                                      $floor: {
                                        $divide: ["$avgResolutionTime", 1440],
                                      },
                                    },
                                    1,
                                  ],
                                },
                                then: "s",
                                else: "",
                              },
                            },
                            " ",
                          ],
                        },
                        else: "",
                      },
                    },
                    {
                      $cond: {
                        if: {
                          $gte: [{ $mod: ["$avgResolutionTime", 1440] }, 60],
                        }, // Remaining hours
                        then: {
                          $concat: [
                            {
                              $toString: {
                                $round: [
                                  {
                                    $floor: {
                                      $divide: [
                                        { $mod: ["$avgResolutionTime", 1440] },
                                        60,
                                      ],
                                    },
                                  },
                                  2,
                                ],
                              },
                            },
                            " hr",
                            {
                              $cond: {
                                if: {
                                  $gt: [
                                    {
                                      $floor: {
                                        $divide: [
                                          {
                                            $mod: ["$avgResolutionTime", 1440],
                                          },
                                          60,
                                        ],
                                      },
                                    },
                                    1,
                                  ],
                                },
                                then: "s",
                                else: "",
                              },
                            },
                            " ",
                          ],
                        },
                        else: "",
                      },
                    },
                    {
                      $cond: {
                        if: { $gte: [{ $mod: ["$avgResolutionTime", 60] }, 1] }, // Remaining minutes
                        then: {
                          $concat: [
                            {
                              $toString: {
                                $round: [
                                  { $mod: ["$avgResolutionTime", 60] },
                                  2,
                                ],
                              },
                            },
                            " min",
                            {
                              $cond: {
                                if: {
                                  $gt: [
                                    { $mod: ["$avgResolutionTime", 60] },
                                    1,
                                  ],
                                },
                                then: "s",
                                else: "",
                              },
                            },
                            " ",
                          ],
                        },
                        else: "",
                      },
                    },
                    {
                      $cond: {
                        if: { $gt: [{ $mod: ["$avgResolutionTime", 1] }, 0] }, // Remaining seconds
                        then: {
                          $concat: [
                            {
                              $toString: {
                                $round: [
                                  {
                                    $multiply: [
                                      { $mod: ["$avgResolutionTime", 1] },
                                      60,
                                    ],
                                  },
                                  2,
                                ],
                              },
                            },
                            " sec",
                            {
                              $cond: {
                                if: {
                                  $gt: [
                                    {
                                      $multiply: [
                                        { $mod: ["$avgResolutionTime", 1] },
                                        60,
                                      ],
                                    },
                                    1,
                                  ],
                                },
                                then: "s",
                                else: "",
                              },
                            },
                          ],
                        },
                        else: "",
                      },
                    },
                  ],
                },
                else: "0 sec",
              },
            },
          },
        },
      ]);

      // Ensure all complaint types are included in the response, except "not selected"
      const complaintTypes = Object.values(ComplaintTypes).filter(
        (type) => type !== ComplaintTypes.NOT_SELECTED
      );
      const formattedReport = complaintTypes.map((type) => {
        const found = resolutionData.find((item) => item.categoryType === type);
        return (
          found || {
            categoryType: type,
            resolvedCount: 0,
            avgResolutionTimeInHours: 0,
          }
        );
      });

      return { report: formattedReport };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get all complaint
  async exportComplaintDetails(
    type: ExportTypes,
    staffId: string,
    status: ComplainStatusTypes,
    role: string,
    hostelId?: string,
    categoryId?: string,
    sort?: SortingTypes,
    startDate?: string,
    endDate?: string,
    search?: string,
    floorNumber?: string,
    roomNumber?: string,
    compaintIds?: string[]
  ): Promise<{ complaint: any[] }> {
    try {
      let query: any = {};
      let searchUserParams: any = {};

      if (type === ExportTypes.INDIVIDUAL && compaintIds?.length) {
        // If type is INDIVIDUAL, fetch only specific complaints
        query._id = {
          $in: compaintIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      } else {
        // Apply existing filters for type ALL
        if (status !== ComplainStatusTypes.ALL) {
          query.complainStatus = status;
        }

        // Role-based filtering using switch-case
        switch (true) {
          case role === "super admin":
            break; // Fetch all complaints
          case /admin$/i.test(role) && hostelId !== undefined:
            query.hostelId = new mongoose.Types.ObjectId(hostelId);
            break;
          default:
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

      const complaint = await Complaint.find({ ...query, ...searchUserParams })
        .populate([
          { path: "userId", select: "name image uniqueId phone email" },
          { path: "hostelId", select: "name identifier" },
          { path: "categoryId", select: "name" },
          { path: "subCategoryId", select: "name" },
          { path: "assignedStaff", select: "name phone image userName" },
          { path: "updatedBy", select: "name" },
        ])
        .sort(sortOptions);

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
                    ? `${hours} hr${hours > 1 ? "s" : ""} ${minutes} min${
                        minutes > 1 ? "s" : ""
                      }`
                    : `${minutes} min${minutes > 1 ? "s" : ""}`;
                })()
              : null;

          return {
            _id: ele._id,
            ticketId: ele?.ticketId,
            complainStatus: ele?.complainStatus,
            categoryType: ele?.categoryType ?? null,
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

      return { complaint: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
}

export default new MaintenanceReportService();
