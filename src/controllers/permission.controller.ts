import { Request, Response } from "express";
import PermissionService from "../services/permission.service";
import StaffService from "../services/staff.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendZodError } from "../utils/responseHelpers";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../utils/messages";
import { CreatePermissionSchema } from "../utils/validators/permission.validator";

const { createPermission, fetchPermissions } = PermissionService;
const { getStaffById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { RECORD_NOT_FOUND } = ERROR_MESSAGES;

class PermissionController {
  //SECTION Controller method to handle permission creation by role id
  addPermissionToRole = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      // Validate input using Zod
      const parseResult = CreatePermissionSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      const staffId = req.body._valid._id;
      const { roleId, web, mobile } = parseResult.data;

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Merge web and mobile permissions
      const permission = [...web, ...mobile];

      // Call the service to create a new permission
      await createPermission(roleId, permission, staffId);

      return sendSuccess(res, CREATE_DATA);
    },
  );

  //SECTION Controller method to handle get permission by staff role Id
  fetchPermissionByStaffRoleId = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const staffId = req.body._valid._id;
      const { roleId } = req.body.validatedData || {};

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Call the service to fetch a permissions
      const { web, mobile } = await fetchPermissions(roleId ?? staff?.roleId);

      return sendSuccess(res, FETCH_SUCCESS, { web, mobile }, 200);
    },
  );
}

export default new PermissionController();
