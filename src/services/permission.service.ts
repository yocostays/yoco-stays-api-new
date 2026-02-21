import mongoose from "mongoose";
import Permission from "../models/permission.model";
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
}

export default new PermissionService();
