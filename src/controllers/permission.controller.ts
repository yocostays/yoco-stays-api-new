import mongoose from "mongoose";
import { Request, Response } from "express";
import PermissionService from "../services/permission.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";

const { createPermission, fetchPermissions } = PermissionService;
const { getStaffById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, INVALID_ROUTE_ID, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class PermissionController {
  //SECTION Controller method to handle permission creation by role id
  async addPermissionToRole(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;
      const { roleId, permission } = req.body;

      if (
        !mongoose.isValidObjectId(staffId) ||
        !mongoose.isValidObjectId(roleId)
      )
        throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Check if any route id is incorrect
      const invalidPermission = permission.find(
        (ele: any) => !mongoose.isValidObjectId(ele.routeId)
      );

      if (invalidPermission) throw new Error(INVALID_ROUTE_ID);

      // Call the service to create a new permission
      await createPermission(roleId, permission, staffId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: CREATE_DATA,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION Controller method to handle get permission by staff role Id
  async fetchPermissionByStaffRoleId(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const staffId = req.body._valid._id;

      if (!mongoose.isValidObjectId(staffId)) throw new Error(INVALID_ID);

      // Call the service to retrieve staff
      const { staff } = await getStaffById(staffId);

      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      const { roleId } = req.body;

      // Call the service to fetch a permissions
      const { permission } = await fetchPermissions(roleId ?? staff?.roleId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: permission,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }
}

export default new PermissionController();
