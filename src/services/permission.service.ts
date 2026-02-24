import mongoose, { PipelineStage } from "mongoose";
import Permission from "../models/permission.model";
import CustomPermission from "../models/customPermission.model";
import Route from "../models/route.model";
import { getCurrentISTTime } from "../utils/lib";
import { SUCCESS_MESSAGES } from "../utils/messages";

const { CREATE_DATA } = SUCCESS_MESSAGES;

class PermissionService {
  //SECTION: Method to create or update permissions (Smart Sync)
  createPermission = async (
    roleId: string,
    permission: any[],
    staffId: string,
  ): Promise<string> => {
    try {
      const operations: any[] = [];
      const now = getCurrentISTTime();
      const role_id = new mongoose.Types.ObjectId(roleId);

      // NOTE: Remove duplicates based on routeIdentifier
      const uniquePermissions = Array.from(
        new Map(
          permission.map((p) => {
            const routeIdentifier = p.routeId || p._id;
            return [routeIdentifier, { ...p, routeId: routeIdentifier }];
          }),
        ).values(),
      ).filter((p) => p.routeId);

      for (const p of uniquePermissions) {
        const route_id = new mongoose.Types.ObjectId(p.routeId);
        const hasAccess = p.add || p.view || p.edit || p.delete;

        if (hasAccess) {
          // Update or Create if any flag is true
          operations.push({
            updateOne: {
              filter: { roleId: role_id, routeId: route_id },
              update: {
                $set: {
                  add: p.add ?? false,
                  view: p.view ?? false,
                  edit: p.edit ?? false,
                  delete: p.delete ?? false,
                  updatedBy: staffId,
                  updatedAt: now,
                  status: true,
                },
                $setOnInsert: {
                  roleId: role_id,
                  routeId: route_id,
                  createdBy: staffId,
                  createdAt: now,
                },
              },
              upsert: true,
            },
          });
        } else {
          // Delete if all flags are false to keep the collection lean
          operations.push({
            deleteOne: {
              filter: { roleId: role_id, routeId: route_id },
            },
          });
        }
      }

      if (operations.length > 0) {
        await Permission.bulkWrite(operations);
      }

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to fetch permission of staff
  fetchPermissions = async (
    roleId: string,
  ): Promise<{ web: any[]; mobile: any[] }> => {
    try {
      const pipeline = [
        { $match: { status: true } },
        {
          $lookup: {
            from: "permissions",
            let: { route_id: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$routeId", "$$route_id"] },
                      {
                        $eq: ["$roleId", new mongoose.Types.ObjectId(roleId)],
                      },
                    ],
                  },
                },
              },
            ],
            as: "permission",
          },
        },
        { $unwind: { path: "$permission", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            title: 1,
            link: 1,
            icon: 1,
            platform: 1,
            add: { $ifNull: ["$permission.add", false] },
            view: { $ifNull: ["$permission.view", false] },
            edit: { $ifNull: ["$permission.edit", false] },
            delete: { $ifNull: ["$permission.delete", false] },
          },
        },
        { $sort: { platform: -1, title: 1 } as any },
      ];

      const permissions: any[] = await Route.aggregate(pipeline);

      // Split permissions into web and mobile
      const webPermissions = permissions.filter(
        (p: any) => p.platform === "web",
      );
      const mobilePermissions = permissions.filter(
        (p: any) => p.platform === "mobile",
      );

      return { web: webPermissions, mobile: mobilePermissions };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to fetch custom permissions (Hostel + Role specific)
  // Priority: Custom (Hostel+Role) > General (Role) > Default (False)
  fetchCustomPermissionsService = async (
    hostelId: string,
    roleId: string,
  ): Promise<{ web: any[]; mobile: any[] }> => {
    try {
      const hostel_id = new mongoose.Types.ObjectId(hostelId);
      const role_id = new mongoose.Types.ObjectId(roleId);

      const pipeline = [
        { $match: { status: true } },
        {
          $lookup: {
            from: "custompermissions",
            let: { route_id: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$routeId", "$$route_id"] },
                      { $eq: ["$roleId", role_id] },
                      { $eq: ["$hostelId", hostel_id] },
                    ],
                  },
                },
              },
            ],
            as: "custom",
          },
        },
        { $unwind: { path: "$custom", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "permissions",
            let: { route_id: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$routeId", "$$route_id"] },
                      { $eq: ["$roleId", role_id] },
                    ],
                  },
                },
              },
            ],
            as: "general",
          },
        },
        { $unwind: { path: "$general", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            title: 1,
            link: 1,
            icon: 1,
            platform: 1,
            // Priority: Custom > General > Default(false)
            add: {
              $ifNull: ["$custom.add", { $ifNull: ["$general.add", false] }],
            },
            view: {
              $ifNull: ["$custom.view", { $ifNull: ["$general.view", false] }],
            },
            edit: {
              $ifNull: ["$custom.edit", { $ifNull: ["$general.edit", false] }],
            },
            delete: {
              $ifNull: [
                "$custom.delete",
                { $ifNull: ["$general.delete", false] },
              ],
            },
          },
        },
        { $sort: { platform: -1, title: 1 } as any },
      ];

      const permissions: any[] = await Route.aggregate(pipeline);

      const webPermissions = permissions.filter(
        (p: any) => p.platform === "web",
      );
      const mobilePermissions = permissions.filter(
        (p: any) => p.platform === "mobile",
      );

      return { web: webPermissions, mobile: mobilePermissions };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to save custom permissions (Hostel-Wise Overrides)
  saveCustomPermissionService = async (
    hostelId: string,
    roleId: string,
    permission: any[],
    staffId: string,
  ): Promise<string> => {
    try {
      const operations: any[] = [];
      const now = getCurrentISTTime();
      const role_id = new mongoose.Types.ObjectId(roleId);
      const hostel_id = new mongoose.Types.ObjectId(hostelId);

      const uniquePermissions = Array.from(
        new Map(
          permission.map((p) => {
            const routeIdentifier = p.routeId || p._id;
            return [routeIdentifier, { ...p, routeId: routeIdentifier }];
          }),
        ).values(),
      ).filter((p) => p.routeId);

      for (const p of uniquePermissions) {
        const route_id = new mongoose.Types.ObjectId(p.routeId);
        const hasAccess = p.add || p.view || p.edit || p.delete;

        if (hasAccess) {
          operations.push({
            updateOne: {
              filter: {
                roleId: role_id,
                hostelId: hostel_id,
                routeId: route_id,
              },
              update: {
                $set: {
                  add: p.add ?? false,
                  view: p.view ?? false,
                  edit: p.edit ?? false,
                  delete: p.delete ?? false,
                  updatedBy: staffId,
                  updatedAt: now,
                  status: true,
                },
                $setOnInsert: {
                  roleId: role_id,
                  hostelId: hostel_id,
                  routeId: route_id,
                  createdBy: staffId,
                  createdAt: now,
                },
              },
              upsert: true,
            },
          });
        } else {
          operations.push({
            deleteOne: {
              filter: {
                roleId: role_id,
                hostelId: hostel_id,
                routeId: route_id,
              },
            },
          });
        }
      }

      if (operations.length > 0) {
        await CustomPermission.bulkWrite(operations);
      }

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to get user permissions for WEB after login
  // Filters: View=true, Platform=web, Priority: Custom > General
  async getUserPermissionsWeb(
    hostelId: string,
    roleId: string,
  ): Promise<any[]> {
    try {
      const hostel_id = new mongoose.Types.ObjectId(hostelId);
      const role_id = new mongoose.Types.ObjectId(roleId);

      const pipeline: PipelineStage[] = [
        { $match: { platform: "web", status: true } },
        {
          $lookup: {
            from: "custompermissions",
            let: { route_id: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$routeId", "$$route_id"] },
                      { $eq: ["$roleId", role_id] },
                      { $eq: ["$hostelId", hostel_id] },
                    ],
                  },
                },
              },
            ],
            as: "custom",
          },
        },
        { $unwind: { path: "$custom", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "permissions",
            let: { route_id: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$routeId", "$$route_id"] },
                      { $eq: ["$roleId", role_id] },
                    ],
                  },
                },
              },
            ],
            as: "general",
          },
        },
        { $unwind: { path: "$general", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            title: 1,
            link: 1,
            icon: 1,
            // Prioritize Custom > General > Default False
            view: {
              $ifNull: ["$custom.view", { $ifNull: ["$general.view", false] }],
            },
            add: {
              $ifNull: ["$custom.add", { $ifNull: ["$general.add", false] }],
            },
            edit: {
              $ifNull: ["$custom.edit", { $ifNull: ["$general.edit", false] }],
            },
            delete: {
              $ifNull: [
                "$custom.delete",
                { $ifNull: ["$general.delete", false] },
              ],
            },
          },
        },
        { $match: { view: true } }, // Final filter to only return accessible routes
        { $sort: { title: 1 } },
      ];

      return await Route.aggregate(pipeline);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
}

export default new PermissionService();
