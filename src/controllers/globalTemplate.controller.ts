import { Request, Response } from "express";
import GlobalTemplateService, { DuplicateError } from "../services/globalTemplate.service";
import HostelTemplateService from "../services/hostelTemplate.service";
import { HttpResponse } from "../utils/httpResponse";
import { SUCCESS_MESSAGES, ERROR_MESSAGES, VALIDATION_MESSAGES } from "../utils/messages";
import { createGlobalTemplateSchema, createSubcategorySchema } from "../utils/validators/globalTemplate.validator";

const { createGlobalTemplate, getGlobalTemplates, getGlobalTemplateById, addSubcategory, deleteGlobalTemplate } = GlobalTemplateService;
const { getHostelTemplatesSummary, addSubcategoryToHostelTemplate } = HostelTemplateService;


const { CREATE_DATA, FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { ALREADY_EXIST_FIELD_ONE } = VALIDATION_MESSAGES;

class GlobalTemplateController {
  //this function is for creating global template categories
  async createTempletCategories(req: Request, res: Response): Promise<Response<HttpResponse>> {
    try {
      const { error, value } = createGlobalTemplateSchema.validate(req.body, { stripUnknown: true });
      if (error) {
        return res.status(400).json({ statusCode: 400, message: error.details[0].message });
      }

      const createdBy = req.body._valid?._id || "system";

      const template = await createGlobalTemplate({ ...value, createdBy });

      return res.status(200).json({ statusCode: 200, message: CREATE_DATA, data: template });
    } catch (error: any) {
      if (error instanceof DuplicateError || error.code === 11000) {
        return res.status(400).json({ statusCode: 400, message: ALREADY_EXIST_FIELD_ONE("Category") });
      }
      return res.status(500).json({ statusCode: 500, message: error.message ?? SERVER_ERROR });
    }
  }

  //this function fetches all global template categories
  async getAllCategories(req: Request, res: Response): Promise<Response<HttpResponse>> {
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
      return res.status(200).json({ statusCode: 200, message: FETCH_SUCCESS, length: templates.length, data: templates });
    } catch (error: any) {
      return res.status(400).json({ statusCode: 400, message: error.message ?? SERVER_ERROR });
    }
  }

  async getById(req: Request, res: Response): Promise<Response<HttpResponse>> {
    try {
      const { id } = req.params;
      const template = await getGlobalTemplateById(id);
      if (!template) return res.status(404).json({ statusCode: 404, message: RECORD_NOT_FOUND("Template") });

      return res.status(200).json({ statusCode: 200, message: FETCH_SUCCESS, data: template });
    } catch (error: any) {
      return res.status(400).json({ statusCode: 400, message: error.message ?? SERVER_ERROR });
    }
  }

  //here we are adding subcategory to existing global template category
  async createSubcategory(req: Request, res: Response): Promise<Response<HttpResponse>> {
    try {
      const { categoryId } = req.params;
      const { error, value } = createSubcategorySchema.validate(req.body, { stripUnknown: true });
      if (error) {
        return res.status(400).json({ statusCode: 400, message: error.details[0].message });
      }

      const result = await addSubcategory(categoryId, value);
      
      if (!result) {
        return res.status(404).json({ statusCode: 404, message: RECORD_NOT_FOUND("Category") });
      }

   
      return res.status(201).json({ 
        statusCode: 201, 
        message: CREATE_DATA, 
        data: result.newSubcategory 
      });
    } catch (error: any) {
      if (error instanceof DuplicateError) {
        let existing = {};
        try { existing = JSON.parse(error.message); } catch (e) { /* ignore parse error */ }
        
        return res.status(409).json({ 
          statusCode: 409, 
          message: "Subcategory already exists",
          existing 
        });
      }
      return res.status(500).json({ statusCode: 500, message: error.message ?? SERVER_ERROR });
    }
  }

  //here we fetch summary of hostel templates with pagination
  async getHostelTemplatesSummary(req: Request, res: Response): Promise<Response<HttpResponse>> {
    try {
      const { hostelId, page = "1", limit = "10" } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          statusCode: 400,
          message: "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100."
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
        limit: result.limit,
        data: result.data
      });
    } catch (error: any) {
      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR
      });
    }
  }


  //here we fetch all categoris for that hostel applied as well as non-applied
  async getHostelCategoriesForEdit(req: Request, res: Response): Promise<Response<HttpResponse>> {
    try {
      const { hostelId } = req.params;

      if (!hostelId || !/^[0-9a-fA-F]{24}$/.test(hostelId)) {
        return res.status(400).json({
          statusCode: 400,
          message: "Invalid hostelId format"
        });
      }

      // Call service to get categories
      const { getHostelCategoriesForEdit: getCategories } = HostelTemplateService;
      const result = await getCategories(hostelId);

      return res.status(200).json({
        statusCode: 200,
        message: FETCH_SUCCESS,
        totalApplied: result.totalApplied,
        totalNotApplied: result.totalNotApplied,
        data: {
          applied: result.applied,
          notApplied: result.notApplied
        }
      });

    } catch (error: any) {
      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR
      });
    }
  }


  //here we add templets that not availbele in that hostel
  async addSubcategoryToHostelTemplate(req: Request, res: Response): Promise<Response<HttpResponse>> {
    try {
      const { hostelId, globalTemplateId, title, slug, description, isActive, hostelName, hostelCode } = req.body;

      // Validate required fields
      if (!hostelId) {
        return res.status(400).json({
          statusCode: 400,
          message: "hostelId is required"
        });
      }

      if (!globalTemplateId) {
        return res.status(400).json({
          statusCode: 400,
          message: "globalTemplateId is required"
        });
      }

      if (!title || !title.trim()) {
        return res.status(400).json({
          statusCode: 400,
          message: "Subcategory title is required"
        });
      }

      // Validate ObjectId format
      if (!/^[0-9a-fA-F]{24}$/.test(hostelId)) {
        return res.status(400).json({
          statusCode: 400,
          message: "Invalid hostelId format"
        });
      }

      if (!/^[0-9a-fA-F]{24}$/.test(globalTemplateId)) {
        return res.status(400).json({
          statusCode: 400,
          message: "Invalid globalTemplateId format"
        });
      }

      // Call service to add subcategory
      const result = await addSubcategoryToHostelTemplate(
        hostelId,
        globalTemplateId,
        { title, slug, description, isActive },
        hostelName,
        hostelCode
      );

      return res.status(201).json({
        statusCode: 201,
        message: result.categoryWasCreated 
          ? "Category applied and subcategory added successfully"
          : "Subcategory added successfully",
        data: {
          hostelTemplate: result.hostelTemplate,
          newSubcategory: result.newSubcategory,
          categoryWasCreated: result.categoryWasCreated
        }
      });

    } catch (error: any) {
      // Handle specific error cases
      if (error.message.includes("already exists")) {
        return res.status(409).json({
          statusCode: 409,
          message: error.message
        });
      }

      if (error.message.includes("not found") || error.message.includes("Invalid")) {
        return res.status(404).json({
          statusCode: 404,
          message: error.message
        });
      }

      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR
      });
    }
  }

  //here we are deleting global category and all its subcategories if any hostel are not using them
  async deleteGlobalCategory(req: Request, res: Response): Promise<Response<HttpResponse>> {
    try {
      const { categoryId } = req.params;

      if (!categoryId || !/^[0-9a-fA-F]{24}$/.test(categoryId)) {
        return res.status(400).json({
          statusCode: 400,
          message: "Invalid category ID format"
        });
      }

        const result = await deleteGlobalTemplate(categoryId);

      return res.status(200).json({
        statusCode: 200,
        message: result.message,
        data: result.category
      });

    } catch (error: any) {
      // Handle specific error cases
      if (error.message.includes("currently used")) {
        return res.status(409).json({
          statusCode: 409,
          message: error.message
        });
      }

      if (error.message.includes("not found") || error.message.includes("Invalid")) {
        return res.status(404).json({
          statusCode: 404,
          message: error.message
        });
      }

      return res.status(500).json({
        statusCode: 500,
        message: error.message ?? SERVER_ERROR
      });
    }
  }
}

export default new GlobalTemplateController();
