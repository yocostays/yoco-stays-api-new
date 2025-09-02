import Role, { IRole } from "../models/role.model";
import { CategoryTypes } from "../utils/enum";
import { getCurrentISTTime } from "../utils/lib";
import { ERROR_MESSAGES } from "../utils/messages";

const { RECORD_NOT_FOUND } = ERROR_MESSAGES;

class RoleService {
  //SECTION: Method to create a new role
  async createNewRole(
    name: string,
    categoryType: CategoryTypes,
    staffId: string
  ): Promise<IRole> {
    try {
      // Check if a role with the same name and categoryType already exists
      const existingRole = await Role.findOne({ name, categoryType });
      if (existingRole) {
        throw new Error(
          `Role with the name '${name}' already exists under category '${categoryType}'.`
        );
      }

      const newRole = new Role({
        name,
        categoryType,
        createdBy: staffId,
        createdAt: getCurrentISTTime(),
      });

      return await newRole.save();
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get all role
  async getAllRolesWithPagination(
    page: number,
    limit: number,
    search?: string
  ): Promise<{ roles: any[]; count: number }> {
    try {
      // Calculate the number of documents to skip
      const skip = (page - 1) * limit;

      // Build the query for searching roles
      const query: { name?: { $regex: RegExp } } = {};
      if (search) {
        query.name = { $regex: new RegExp(`\\b${search}\\b`, "i") };
      }

      // Run both queries in parallel
      const [roles, count] = await Promise.all([
        Role.find(query)
          .populate([{ path: "createdBy", select: "name" }])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Role.countDocuments(query),
      ]);

      //NOTE - send response
      const response = roles.map((ele) => ({
        _id: ele._id,
        name: ele?.name ?? null,
        categoryType: ele?.categoryType ?? null,
        createdBy: (ele?.createdBy as any)?.name ?? null,
        createdAt: ele?.createdAt ?? null,
      }));

      return { roles: response, count };
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
  async updateRoleInAdmin(
    id: string,
    name: string,
    staffId: string,
    status?: boolean,
    categoryType?: CategoryTypes
  ): Promise<any> {
    try {
      // Check if a role with the same name already exists
      const existingRole = await Role.findOne({ _id: { $ne: id }, name,categoryType });
      if (existingRole) {
        throw new Error(`Role with the name '${name}' already exists.`);
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
