import { PipelineStage } from "mongoose";
import Role, { IRole } from "../models/role.model";
import { ConflictError } from "../utils/errors";
import { getCurrentISTTime } from "../utils/lib";
import { ERROR_MESSAGES } from "../utils/messages";
import { paginateAggregate } from "../utils/pagination";

const { RECORD_NOT_FOUND, DUPLICATE_RECORD } = ERROR_MESSAGES;

class RoleService {
  //SECTION: Method to create a new role
  async createRoleService(
    name: string,
    categoryType: string,
    staffId: string,
  ): Promise<IRole> {
    try {
      // Generate uniqueId
      const lastRole = await Role.findOne().sort({ createdAt: -1 });
      let uniqueId = "R01";
      if (lastRole && lastRole.uniqueId) {
        const lastId = parseInt(lastRole.uniqueId.replace("R", ""), 10);
        uniqueId = `R${lastId + 1}`;
      }

      const newRole = new Role({
        uniqueId,
        name,
        categoryType,
        createdBy: staffId,
        createdAt: getCurrentISTTime(),
      });

      return await newRole.save();
    } catch (error: any) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        if (field === "uniqueId") {
          // Retry if uniqueId collides (rare but possible in concurrent requests)
          return await this.createRoleService(name, categoryType, staffId);
        }
        throw new ConflictError(
          `Role '${name}' already exists in category '${categoryType}'.`,
        );
      }
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get all roles with pagination
  async getAllRolesService(
    pagination: { page: number; limit: number },
    filters: { categoryType?: string; status?: boolean },
    search: { text?: string },
  ): Promise<{ roles: any[]; count: number }> {
    try {
      const pipeline: PipelineStage[] = [];

      // Add match stage for search and filters
      const matchStage: any = {};

      if (search?.text) {
        matchStage.$or = [
          { name: { $regex: search.text, $options: "i" } },
          { categoryType: { $regex: search.text, $options: "i" } },
        ];
      }

      if (filters?.categoryType) {
        matchStage.categoryType = { $regex: `^${filters.categoryType}$`, $options: "i" };
      }

      if (filters?.status !== undefined) {
        matchStage.status = filters.status;
      }

      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }

      // Populate createdBy
      pipeline.push(
        {
          $lookup: {
            from: "staffs",
            localField: "createdBy",
            foreignField: "_id",
            as: "createdBy",
          },
        },
        {
          $unwind: {
            path: "$createdBy",
            preserveNullAndEmptyArrays: true,
          },
        },
      );

      // Sort
      pipeline.push({ $sort: { createdAt: -1 } });

      // Project
      pipeline.push({
        $project: {
          _id: 1,
          uniqueId: 1,
          name: 1,
          categoryType: 1,
          status: 1,
          createdBy: "$createdBy.name",
          createdAt: 1,
        },
      });

      const { page, limit } = pagination;
      const result = await paginateAggregate<any>(Role, pipeline, page, limit);

      return {
        roles: result.data,
        count: result.count,
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get role by id
  async getRoleById(id: string): Promise<{ role: any }> {
    try {
      // Run both queries in parallel
      const role = await Role.findById(id);

      return { role };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get role by name
  async getRoleByName(name: string): Promise<{ role: any }> {
    try {
      // Run both queries in parallel
      const role = await Role.findOne({ name });

      return { role };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to update a new role
  async updateCategoryService(
    id: string,
    staffId: string,
    name?: string,
    status?: boolean,
    categoryType?: string,
  ): Promise<any> {
    try {
      // Check if a role with the same name and categoryType already exists elsewhere
      const query: any = { _id: { $ne: id } };
      if (categoryType) query.categoryType = categoryType;
      if (name) query.name = name;

      const existingRole = await Role.findOne(query);
      if (existingRole) {
        const identifier = name ? `name '${name}'` : "this configuration";
        throw new Error(`Role with ${identifier} already exists.`);
      }

      //NOTE - update role
      return await Role.findByIdAndUpdate(id, {
        $set: {
          name,
          categoryType,
          updatedBy: staffId,
          status: status ? status : true,
          updatedAt: getCurrentISTTime(),
        },
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to delete role by id
  async deleteRoleById(id: string): Promise<any> {
    try {
      // Run both queries in parallel
      const role = await Role.findByIdAndDelete(id);

      if (!role) {
        throw new Error(RECORD_NOT_FOUND("Role"));
      }

      return { role };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get all role without super admin
  async rolesWithoutSuperAdminAndStudent(): Promise<{ roles: any[] }> {
    try {
      // Query to exclude 'superAdmin' and 'student' (case-insensitive)
      const role = await Role.find({
        name: {
          $nin: [
            new RegExp("^superAdmin$", "i"), // Exclude 'superAdmin'
            new RegExp("^student$", "i"), // Exclude 'student'
          ],
        },
      });

      // Format the response
      const response = role.map((ele) => ({
        _id: ele._id,
        name: ele?.name ?? null,
      }));

      return { roles: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get All Roles For Warden Panel
  async getAllRolesForWardenPanel(): Promise<{ roles: any[] }> {
    try {
      // Fetch roles matching the specified names
      const roles = await Role.find({
        name: {
          $in: [
            new RegExp("^student$", "i"),
            new RegExp("^admin$", "i"),
            new RegExp("^security guard$", "i"),
            new RegExp("^warden$", "i"),
          ],
        },
      });

      // Create a mapping object for the sequence
      const roleOrder = ["student", "admin", "warden", "security guard"];

      // Sort the fetched roles based on the specified sequence
      const sortedRoles = roleOrder
        .map((name) => roles.find((role) => role.name.toLowerCase() === name))
        .filter(Boolean)
        .map((role) => ({
          _id: role?._id,
          name: role?.name ?? null,
        }));

      return { roles: sortedRoles };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
}

export default new RoleService();
