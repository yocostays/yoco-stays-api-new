import { Request, Response } from "express";
import mongoose from "mongoose";
import RoleService from "../services/role.service";
import RoleCategoryService from "../services/roleCategory.service";
import StaffService from "../services/staff.service";
import { asyncHandler } from "../utils/asyncHandler";
import { NotFoundError } from "../utils/errors";
import { HttpResponse } from "../utils/httpResponse";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";
import { sendSuccess, sendZodError } from "../utils/responseHelpers";
import { CreateRoleSchema } from "../utils/validators/role.validator";
import {
  CreateRoleCategorySchema,
  UpdateRoleCategorySchema,
} from "../utils/validators/roleCategory.validator";

const {
  createRoleService,
  getAllRolesService,
  getRoleById,
  updateCategoryService,
  deleteRoleById,
  getRoleByName,
  rolesWithoutSuperAdminAndStudent,
  getAllRolesForWardenPanel,
} = RoleService;

const {
  createCategoryService: createRoleCategoryService,
  getAllCategoriesService,
  updateCategoryService: updateRoleCategoryService,
} = RoleCategoryService;

const { getStaffById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS, UPDATE_DATA, DELETE_DATA } =
  SUCCESS_MESSAGES;
const { REQUIRED_FIELD, INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class RoleController {
  // ------------------------controller methods for role categories------------------------

  //SECTION Controller method to handle category creation
  createCategory = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const createdById = req.body._valid?._id;

      if (createdById) {
        // Call the service to retrieve staff
        const { staff } = await getStaffById(createdById);
        if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      const { categoryType } = req.body;

      // Validate input using Zod
      const parseResult = CreateRoleCategorySchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      // Call the service to create a new role category
      await createRoleCategoryService(categoryType, createdById);

      return sendSuccess(res, CREATE_DATA);
    },
  );

  //SECTION Controller method to get all role categories
  getAllCategories = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      // Call the service to retrieve categories
      const { categories, count } = await getAllCategoriesService();

      return sendSuccess(res, FETCH_SUCCESS, categories, 200, count);
    },
  );

  //SECTION Controller method to update category by id
  updateCategory = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { id } = req.params;
      const updatedById = req.body._valid?._id;

      if (
        !mongoose.isValidObjectId(updatedById) ||
        !mongoose.isValidObjectId(id)
      ) {
        throw new Error(INVALID_ID);
      }

      // Call the service to retrieve staff
      const { staff } = await getStaffById(updatedById);
      if (!staff) throw new NotFoundError(RECORD_NOT_FOUND("Staff"));

      const { categoryType, status } = req.body;

      // Validate input using Zod
      const parseResult = UpdateRoleCategorySchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      // Call the service to update a role category
      await updateRoleCategoryService(id, updatedById, categoryType, status);

      return sendSuccess(res, UPDATE_DATA);
    },
  );

  // ---------------------------------------------------------------------------------------------------

  // ------------------------controller methods for roles-----------------------------------------------

  //SECTION: Controller method to handle role creation
  createRole = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const createdById = req.body._valid?._id;

      if (createdById) {
        // Call the service to retrieve staff
        const { staff } = await getStaffById(createdById);
        if (!staff) throw new NotFoundError(RECORD_NOT_FOUND("Staff"));
      }

      const { name, categoryType } = req.body;

      // Validate input using Zod
      const parseResult = CreateRoleSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      // Call the service to create a new role
      await createRoleService(name, categoryType, createdById);

      return sendSuccess(res, CREATE_DATA);
    },
  );

  //SECTION: Controller method to get all roles with pagination
  getAllRoles = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { pagination, filters, search } = req.body;

      // Extract values with defaults
      const page = Number(pagination?.page) || 1;
      const limit = Number(pagination?.limit) || 10;

      // Call the service to retrieve roles
      const { roles, count } = await getAllRolesService(
        { page, limit },
        filters || {},
        search || {},
      );

      return sendSuccess(res, FETCH_SUCCESS, roles, 200, count);
    },
  );

  // ---------------------------------------------------------------------------------------------------

  //SECTION Controller method to get role by id
  async getRoleById(
    req: Request,
    res: Response,
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

  //SECTION Controller method to delete role by id
  async deleteRoleById(
    req: Request,
    res: Response,
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
    res: Response,
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
    res: Response,
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
    res: Response,
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
