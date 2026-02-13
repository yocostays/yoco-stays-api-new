import mongoose from "mongoose";
import { Request, Response } from "express";
import RoutesService from "../services/routes.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { sendSuccess, sendZodError } from "../utils/responseHelpers";
import { asyncHandler } from "../utils/asyncHandler";
import {
  CreateRouteSchema,
  UpdateRouteSchema,
} from "../utils/validators/route.validator";

const { createNewRoutes, allRoutesDetails, deleteRouteById, updateRouteById } =
  RoutesService;

const { getStaffById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS, DELETE_DATA, UPDATE_DATA } =
  SUCCESS_MESSAGES;
const { INVALID_ID } = VALIDATION_MESSAGES;
const { RECORD_NOT_FOUND, SERVER_ERROR } = ERROR_MESSAGES;

class RoutesController {
  //SECTION Controller method to handle routes creation
  createNewRoutes = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const createdById = req.body._valid?._id;

      if (createdById) {
        // Call the service to retrieve staff
        const { staff } = await getStaffById(createdById);
        if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      // Validate input using Zod
      const parseResult = CreateRouteSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      const { title, link, icon, platform } = parseResult.data;

      // Call the service to create a new routes
      await createNewRoutes(title, link, icon, platform, createdById);

      return sendSuccess(res, CREATE_DATA, undefined, 201);
    },
  );

  //SECTION Controller method to handle get all routes
  getAllRoutes = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { platform, page, limit } = req.query;

      const pageNumber = page ? parseInt(page as string, 10) : 1;
      const limitNumber = limit ? parseInt(limit as string, 10) : 10;

      // Call the service to retrieve routes
      const result = await allRoutesDetails(
        platform as string,
        pageNumber,
        limitNumber,
      );

      return sendSuccess(res, FETCH_SUCCESS, result, 200);
    },
  );

  //SECTION Controller method to update route by id
  updateRouteById = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { id } = req.params;
      const updatedById = req.body._valid?._id;

      if (
        !mongoose.isValidObjectId(id) ||
        !mongoose.isValidObjectId(updatedById)
      ) {
        throw new Error(INVALID_ID);
      }

      const { staff } = await getStaffById(updatedById);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Validate input using Zod
      const parseResult = UpdateRouteSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      await updateRouteById(id, updatedById, req.body);

      return sendSuccess(res, UPDATE_DATA);
    },
  );

  //SECTION Controller method to delete route by id
  deleteRouteById = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) throw new Error(INVALID_ID);

      // Call the service to delete routes
      await deleteRouteById(id);

      return sendSuccess(res, DELETE_DATA);
    },
  );
}

export default new RoutesController();
