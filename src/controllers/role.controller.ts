import mongoose from "mongoose";
import { Request, Response } from "express";
import RoleService from "../services/role.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";

const {
  createNewRole,
  getAllRolesWithPagination,
  getRoleById,
  updateRoleInAdmin,
  deleteRoleById,
  getRoleByName,
  rolesWithoutSuperAdminAndStudent,
  getAllRolesForWardenPanel,
} = RoleService;

const { getStaffById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS, UPDATE_DATA, DELETE_DATA } =
  SUCCESS_MESSAGES;
const { REQUIRED_FIELD, INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class RoleController {
  //SECTION Controller method to handle role creation
  async createNewRole(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid?._id;
      if (createdById && !mongoose.isValidObjectId(createdById))
        throw new Error(INVALID_ID);

      if (createdById) {
        // Call the service to retrieve staff
        const { staff } = await getStaffById(createdById);
        if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { name, categoryType } = req.body;

      if (!name) {
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: REQUIRED_FIELD(name),
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to create a new role
      await createNewRole(name,categoryType, createdById);

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

  //SECTION Controller method to get roles with optional pagination and search
  async getAllRolesWithPagination(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { page, limit, search, categoryType } = req.query;

      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);

      // Call the service to retrieve roles
      const { roles, count } = await getAllRolesWithPagination(
        parsedPage,
        parsedLimit,
        search as string
      );

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: roles,
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

  //SECTION Controller method to get role by id
  async getRoleById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve roles
      const { role } = await getRoleById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: role,
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

  //SECTION Controller method to update role by id
  async updateRoleDetails(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      const updatedById = req.body._valid._id;
      if (
        !mongoose.isValidObjectId(updatedById) ||
        !mongoose.isValidObjectId(id)
      ) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(updatedById);

      if (!staff) {
        throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { name, status, categoryType } = req.body;

      if (!name) {
        const errorResponse: HttpResponse = {
          statusCode: 400,
          message: REQUIRED_FIELD(name),
        };
        return res.status(400).json(errorResponse);
      }

      // Call the service to update a new role
      await updateRoleInAdmin(id, name, updatedById, status, categoryType);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: UPDATE_DATA,
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

  //SECTION Controller method to delete role by id
  async deleteRoleById(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      // Call the service to delete roles
      await deleteRoleById(id);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: DELETE_DATA,
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

  //SECTION Controller method to get role by name
  async getRoleByName(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { name } = req.body;

      // Call the service to retrieve roles
      const { role } = await getRoleByName(name);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: role,
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

  //SECTION Controller method to get roles without super admin
  async getAllRolesWithoutSuperAdmin(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      // Call the service to retrieve roles
      const { roles } = await rolesWithoutSuperAdminAndStudent();

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: roles,
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

  //SECTION: Controller method to get roles for warden panel
  async getAllRolesForWardenPanel(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      // Call the service to retrieve roles
      const { roles } = await getAllRolesForWardenPanel();

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: roles,
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

export default new RoleController();
