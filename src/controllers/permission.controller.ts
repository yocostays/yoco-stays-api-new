import mongoose, { PipelineStage } from "mongoose";
import { Request, Response } from "express";
import PermissionService from "../services/permission.service";
import StaffService from "../services/staff.service";
import RoleService from "../services/role.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendZodError } from "../utils/responseHelpers";
import {
  CreatePermissionSchema,
  CreateCustomPermissionSchema,
} from "../utils/validators/permission.validator";
import { NotFoundError, BadRequestError } from "../utils/errors";
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";

const {
  createPermission,
  fetchPermissions,
  fetchCustomPermissionsService,
  saveCustomPermissionService,
  getUserPermissionsWeb,
} = PermissionService;
const { getStaffById } = StaffService;
const { getRolesByHostelService } = RoleService;

const { CREATE_DATA, FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;

class PermissionController {
  //SECTION Controller method to handle permission creation by role id
  addPermissionToRole = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const staffId = req.body._valid?._id;

      // Validate input using Zod
      const parseResult = CreatePermissionSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      const { roleId, permission, web, mobile } = req.body;

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);
      if (!staff) throw new NotFoundError(RECORD_NOT_FOUND("Staff"));

      // Merge web and mobile permissions if they exist, otherwise use permission array
      const mergedPermission = permission || [
        ...(web || []),
        ...(mobile || []),
      ];

      if (!mergedPermission || mergedPermission.length === 0) {
        throw new Error("No permissions provided.");
      }

      // Call the service to create/update permissions
      await createPermission(roleId, mergedPermission, staffId);

      return sendSuccess(res, CREATE_DATA);
    },
  );

  //SECTION Controller method to handle get permission by staff role Id
  fetchPermissionByStaffRoleId = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const staffId = req.body._valid?._id;

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);
      if (!staff) throw new NotFoundError(RECORD_NOT_FOUND("Staff"));

      const { roleId } = req.body;

      // Call the service to fetch permissions
      const { web, mobile } = await fetchPermissions(roleId ?? staff?.roleId);

      return sendSuccess(res, FETCH_SUCCESS, { web, mobile });
    },
  );

  // --------------------This API is used for CUSTOM PERNISSIONs--------------------

  //SECTION Controller method to handle get unique roles by hostelId
  getRolesHostelWise = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { hostelId } = req.body;

      if (!hostelId) {
        throw new BadRequestError(
          VALIDATION_MESSAGES.REQUIRED_FIELD("hostelId"),
        );
      }

      if (!mongoose.isValidObjectId(hostelId)) {
        throw new BadRequestError(INVALID_ID);
      }

      const roles = await getRolesByHostelService(hostelId);

      return sendSuccess(res, FETCH_SUCCESS, roles);
    },
  );

  //SECTION Controller method to handle custom permission creation by role id and hostel id
  addCustomPermissionToRole = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const staffId = req.body._valid?._id;

      // Validate input using Zod
      const parseResult = CreateCustomPermissionSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      const { hostelId, roleId, permission, web, mobile } = req.body;

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);
      if (!staff) throw new NotFoundError(RECORD_NOT_FOUND("Staff"));

      // Merge web and mobile permissions if they exist, otherwise use permission array
      const mergedPermission =
        permission && permission.length > 0
          ? permission
          : [...(web || []), ...(mobile || [])];

      if (!mergedPermission || mergedPermission.length === 0) {
        throw new Error("No permissions provided.");
      }

      // Call the service to create/update custom permissions
      await saveCustomPermissionService(
        hostelId,
        roleId,
        mergedPermission,
        staffId,
      );

      return sendSuccess(res, CREATE_DATA);
    },
  );

  //SECTION Controller method to handle get custom permission by role id and hostel id
  fetchCustomPermissionByHostelAndRole = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { hostelId, roleId } = req.body;

      if (!hostelId) {
        throw new BadRequestError(
          VALIDATION_MESSAGES.REQUIRED_FIELD("hostelId"),
        );
      }

      if (!roleId) {
        throw new BadRequestError(VALIDATION_MESSAGES.REQUIRED_FIELD("roleId"));
      }

      if (
        !mongoose.isValidObjectId(hostelId) ||
        !mongoose.isValidObjectId(roleId)
      ) {
        throw new BadRequestError(INVALID_ID);
      }

      // Call the service to fetch custom permissions
      const { web, mobile } = await fetchCustomPermissionsService(
        hostelId,
        roleId,
      );

      return sendSuccess(res, FETCH_SUCCESS, { web, mobile });
    },
  );

  //SECTION Controller method to handle user permission fetching for web (after login)
  fetchUserPermissionsWeb = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      // Extract userId from session (_valid)
      const userId = req.body?._valid?._id;

      if (!userId || !mongoose.isValidObjectId(userId)) {
        throw new BadRequestError("Invalid session or user ID.");
      }

      // Fetch full staff details from DB to get role and hostel info
      const { staff } = await getStaffById(userId);

      if (!staff) {
        throw new NotFoundError(RECORD_NOT_FOUND("Staff"));
      }

      const roleId = staff.roleId?._id || staff.roleId;

      // Extract first hostelId if multiple exist
      const hostelId =
        Array.isArray(staff.hostelIds) && staff.hostelIds.length > 0
          ? staff.hostelIds[0]._id || staff.hostelIds[0]
          : null;

      if (!roleId) {
        throw new BadRequestError("User role not assigned.");
      }

      if (!hostelId) {
        throw new BadRequestError("No assigned hostel found for this user.");
      }

      // Call the service with derived IDs
      const permissions = await getUserPermissionsWeb(
        hostelId.toString(),
        roleId.toString(),
      );

      return sendSuccess(res, FETCH_SUCCESS, permissions);
    },
  );
}

export default new PermissionController();
