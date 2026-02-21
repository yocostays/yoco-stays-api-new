import mongoose from "mongoose";
import { Request, Response } from "express";
import PermissionService from "../services/permission.service";
import StaffService from "../services/staff.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendZodError } from "../utils/responseHelpers";
import { CreatePermissionSchema } from "../utils/validators/permission.validator";
import { NotFoundError } from "../utils/errors";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../utils/messages";

const { createPermission, fetchPermissions } = PermissionService;
const { getStaffById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { RECORD_NOT_FOUND } = ERROR_MESSAGES;

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
}

export default new PermissionController();
