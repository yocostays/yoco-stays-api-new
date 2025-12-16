import { Request, Response } from "express";
import GlobalTemplateService, {
  DuplicateError,
} from "../services/globalTemplate.service";
import HostelTemplateService from "../services/hostelTemplate.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";
import {
  createGlobalTemplateSchema,
  createSubcategorySchema,
} from "../utils/validators/globalTemplate.validator";

const {
  createGlobalTemplate,
  getGlobalTemplates,
  getGlobalTemplateById,
  bulkUpsertSubcategories,
  deleteGlobalTemplate,
  deleteGlobalSubcategory,
} = GlobalTemplateService;
const {
  getHostelTemplatesSummary,
  addSubcategoryToHostelTemplate,
  updateHostelSubcategoryDetails,
} = HostelTemplateService;

const { CREATE_DATA, FETCH_SUCCESS, DELETE_DATA, UPDATE_DATA } =
  SUCCESS_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { ALREADY_EXIST_FIELD_ONE, REQUIRED_FIELD, INVALID_FIELD } =
  VALIDATION_MESSAGES;

class GlobalTemplateController {
  //this function handles bulk create/update of global template categories (accepts single or array)
  async createTempletCategories(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const createdBy = req.body._valid?._id || "system";
      const isBulk = Array.isArray(req.body);
      const inputData = isBulk ? req.body : [req.body];

      // Validate each item
      const validatedItems = [];
      for (const item of inputData) {
        const { error, value } = createGlobalTemplateSchema.validate(item, {
          stripUnknown: true,
        });
        if (error) {
          return res.status(400).json({
            statusCode: 400,
            message: `Validation error: ${error.details[0].message}`,
          });
        }
        validatedItems.push(value);
      }

      // Process each item
      const results = [];
      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;

      for (const item of validatedItems) {
        try {
          const isUpdate = !!item._id;

          const template = await createGlobalTemplate({
            ...item,
            createdBy: isUpdate ? undefined : createdBy,
            updatedBy: isUpdate ? createdBy : undefined,
          });

          results.push({
            success: true,
            operation: isUpdate ? "update" : "create",
            data: template,
          });

          if (isUpdate) updatedCount++;
          else createdCount++;
        } catch (error: any) {
          failedCount++;
          results.push({
            success: false,
            operation: item._id ? "update" : "create",
            error: error.message,
            input: { _id: item._id, title: item.title },
          });
        }
      }

      if (isBulk) {
        const allFailed =
          failedCount === inputData.length && inputData.length > 0;
        const statusCode = allFailed ? 409 : 200;

        return res.status(statusCode).json({
          statusCode,
          message: allFailed
            ? ALREADY_EXIST_FIELD_ONE("Category")
            : UPDATE_DATA,
        });
      } else {
        if (results[0].success) {
          return res
            .status(results[0].operation === "create" ? 201 : 200)
            .json({
              statusCode: results[0].operation === "create" ? 201 : 200,
              message:
                results[0].operation === "create" ? CREATE_DATA : UPDATE_DATA,
            });
        } else {
          const error = results[0].error;
          if (error.includes("already exists")) {
            return res.status(400).json({
              statusCode: 400,
              message: ALREADY_EXIST_FIELD_ONE("Category"),
            });
          }
          if (error.includes("not found")) {
            return res.status(404).json({ statusCode: 404, message: error });
          }
          return res.status(500).json({ statusCode: 500, message: error });
        }
      }
    } catch (error: any) {
      return res.status(500).json({ statusCode: 500, SERVER_ERROR });
    }
  }

  //this function fetches all global template categories
  async getAllCategories(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { scope, hostelId } = req.query;
      const query: any = {};
      if (scope) query.scope = scope;
      if (hostelId) query.hostelId = hostelId;

      // Filter by Creator (User Requirement)
      if (req.body._valid?._id) {
        query.createdBy = req.body._valid._id;
      }

      const templates = await getGlobalTemplates(query);
      return res.status(200).json({
        statusCode: 200,
        message: FETCH_SUCCESS,
        length: templates.length,
        data: templates,
      });
    } catch (error: any) {
      return res
        .status(400)
        .json({ statusCode: 400, message: error.message ?? SERVER_ERROR });
    }
  }

  async getById(req: Request, res: Response): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;
      const template = await getGlobalTemplateById(id);
      if (!template)
        return res
          .status(404)
          .json({ statusCode: 404, message: RECORD_NOT_FOUND("Template") });

      return res
        .status(200)
        .json({ statusCode: 200, message: FETCH_SUCCESS, data: template });
    } catch (error: any) {
      return res
        .status(400)
        .json({ statusCode: 400, message: error.message ?? SERVER_ERROR });
    }
  }

  //here we are handling bulk create/update of subcategories across categories
  async createSubcategory(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const inputData = Array.isArray(req.body) ? req.body : [req.body];

      if (inputData.length === 0) {
        return res.status(400).json({
          statusCode: 400,
          message: "Request body cannot be empty",
        });
      }

      for (const item of inputData) {
        if (!item.categoryId) {
          return res.status(400).json({
            statusCode: 400,
            message: "categoryId is required for each item",
          });
        }
        if (
          !Array.isArray(item.subcategories) ||
          item.subcategories.length === 0
        ) {
          return res.status(400).json({
            statusCode: 400,
            message: "subcategories array is required and cannot be empty",
          });
        }
      }

      const result = await bulkUpsertSubcategories(inputData);

      return res.status(200).json({
        statusCode: 200,
        message: CREATE_DATA,
      });
    } catch (error: any) {
      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR,
      });
    }
  }

  //here we fetch summary of hostel templates with pagination
  async getHostelTemplatesSummary(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { hostelId, page = "1", limit = "10" } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          statusCode: 400,
          message:
            "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100.",
        });
      }

      const result = await getHostelTemplatesSummary(
        hostelId as string | undefined,
        pageNum,
        limitNum
      );
      return res.status(200).json({
        statusCode: 200,
        message: FETCH_SUCCESS,
        totalHostels: result.totalHostels,
        page: result.page,
        nextPage: result.hasNextPage,
        prevPage: result.hasPrevPage,
        limit: result.limit,
        data: result.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR,
      });
    }
  }

  //here we fetch all categoris for that hostel applied as well as non-applied
  async getHostelCategoriesForEdit(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { hostelId } = req.params;

      if (!hostelId || !/^[0-9a-fA-F]{24}$/.test(hostelId)) {
        return res.status(400).json({
          statusCode: 400,
          message: "Invalid hostelId format",
        });
      }

      // Call service to get categories
      const { getHostelCategoriesForEdit: getCategories } =
        HostelTemplateService;
      const result = await getCategories(hostelId);

      return res.status(200).json({
        statusCode: 200,
        message: FETCH_SUCCESS,
        totalApplied: result.totalApplied,
        totalNotApplied: result.totalNotApplied,
        data: [...result.applied, ...result.notApplied],
      });
    } catch (error: any) {
      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR,
      });
    }
  }

  //here we add templets that not availbele in that hostel
  async addSubcategoryToHostelTemplate(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const {
        hostelId,
        globalTemplateId,
        subcategoryId,
        hostelName,
        hostelCode,
      } = req.body;

      // Validate required fields
      if (!hostelId) {
        return res.status(400).json({
          statusCode: 400,
          message: "hostelId is required",
        });
      }

      if (!globalTemplateId) {
        return res.status(400).json({
          statusCode: 400,
          message: "globalTemplateId is required",
        });
      }

      if (!subcategoryId) {
        return res.status(400).json({
          statusCode: 400,
          message: "subcategoryId is required",
        });
      }

      // Validate ObjectId format
      const objectIdRegex = /^[0-9a-fA-F]{24}$/;
      if (
        !objectIdRegex.test(hostelId) ||
        !objectIdRegex.test(globalTemplateId) ||
        !objectIdRegex.test(subcategoryId)
      ) {
        return res.status(400).json({
          statusCode: 400,
          message: INVALID_FIELD("ID"),
        });
      }

      // Call service to add subcategory
      const result = await addSubcategoryToHostelTemplate(
        hostelId,
        globalTemplateId,
        subcategoryId,
        hostelName,
        hostelCode
      );

      return res.status(201).json({
        statusCode: 201,
        message: result.categoryWasCreated
          ? "Category applied and subcategory added successfully"
          : "Subcategory added successfully",
      });
    } catch (error: any) {
      // Handle specific error cases
      if (
        error.message.includes("already exists") ||
        error.message.includes("already applied")
      ) {
        return res.status(409).json({
          statusCode: 409,
          message: error.message,
        });
      }

      if (
        error.message.includes("not found") ||
        error.message.includes("Invalid")
      ) {
        return res.status(404).json({
          statusCode: 404,
          message: error.message,
        });
      }

      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR,
      });
    }
  }

  //here we are deleting global category and all its subcategories if any hostel are not using them
  async deleteGlobalCategory(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { categoryId } = req.params;

      if (!categoryId || !/^[0-9a-fA-F]{24}$/.test(categoryId)) {
        return res.status(400).json({
          statusCode: 400,
          message: "Invalid category ID format",
        });
      }

      const result = await deleteGlobalTemplate(categoryId);

      return res.status(200).json({
        statusCode: 200,
        message: DELETE_DATA,
      });
    } catch (error: any) {
      // Handle specific error cases
      if (error.message.includes("currently used")) {
        return res.status(409).json({
          statusCode: 409,
          message: error.message,
        });
      }

      if (
        error.message.includes("not found") ||
        error.message.includes("Invalid")
      ) {
        return res.status(404).json({
          statusCode: 404,
          message: error.message,
        });
      }

      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR,
      });
    }
  }

  // Delete a subcategory from a global template
  async deleteGlobalSubcategory(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { categoryId, subcategoryId } = req.body;

      if (!categoryId || !subcategoryId) {
        return res.status(400).json({
          statusCode: 400,
          message: REQUIRED_FIELD("categoryId and subcategoryId"),
        });
      }

      const objectIdRegex = /^[0-9a-fA-F]{24}$/;
      if (
        !objectIdRegex.test(categoryId) ||
        !objectIdRegex.test(subcategoryId)
      ) {
        return res.status(400).json({
          statusCode: 400,
          message: INVALID_FIELD("ID"),
        });
      }

      const result = await deleteGlobalSubcategory(categoryId, subcategoryId);

      return res.status(200).json({
        statusCode: 200,
        message: result.message,
      });
    } catch (error: any) {
      if (
        error.message.includes("not found") ||
        error.message.includes("Invalid")
      ) {
        return res.status(404).json({
          statusCode: 404,
          message: error.message,
        });
      }

      if (error.message.includes("currently used")) {
        return res.status(409).json({
          statusCode: 409,
          message: error.message,
        });
      }

      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR,
      });
    }
  }


  // Update notification message & description for Applied subcategories
  async updateSubcategoryMessage(
    req: Request,
    res: Response
  ): Promise<Response<HttpResponse>> {
    try {
      const { hostelId, globalTemplateId, updates } = req.body;

      if (!hostelId) {
        return res.status(400).json({
          statusCode: 400,
          message: REQUIRED_FIELD("hostelId"),
        });
      }

      let updateItems = updates;
      if (!updates) {
        const { subcategoryId, message, description } = req.body;
        if (subcategoryId) {
          updateItems = [{ subcategoryId, message, description }];
        }
      }

      if (!Array.isArray(updateItems) || updateItems.length === 0) {
        return res.status(400).json({
          statusCode: 400,
          message: REQUIRED_FIELD(`subcategoryId, message, description`),
        });
      }

      const result = await updateHostelSubcategoryDetails(
        hostelId,
        updateItems,
        globalTemplateId
      );

      return res.status(200).json({
        statusCode: 200,
        message: UPDATE_DATA,
      });
    } catch (error: any) {
      if (
        error.message.includes("not found") ||
        error.message.includes("Is it applied?")
      ) {
        return res.status(404).json({
          statusCode: 404,
          message: error.message,
        });
      }

      if (error.message.includes("Invalid")) {
        return res.status(400).json({
          statusCode: 400,
          message: error.message,
        });
      }

      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR,
      });
    }
  }
}

export default new GlobalTemplateController();
