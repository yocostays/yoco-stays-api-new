import HostelTemplate, {
  IHostelTemplate,
} from "../models/hostelTemplate.model";
import GlobalTemplate from "../models/globalTemplate.model";
import { Types } from "mongoose";
import Hostel from "../models/hostel.model";

// Upsert (Insert or Update) a HostelTemplate based on hostelId and globalTemplateId
const upsertHostelTemplate = async (
  hostelId: string,
  globalTemplateId: string,
  data: Partial<IHostelTemplate>
) => {
  return await HostelTemplate.findOneAndUpdate(
    { hostelId, globalTemplateId },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Initialize templates for a new hostel.
 * Fetches all GLOBAL scope GlobalTemplates and creates copies for the hostel.
 */
const initializeHostelTemplates = async (
  hostelId: Types.ObjectId | string,
  hostelName?: string,
  hostelCode?: string
) => {
  try {
    // Fetch all active Global Templates (Scope: Global)
    const globalTemplates = await GlobalTemplate.find({
      scope: "global",
      isDeleted: false,
      isActive: true,
    }).lean();

    if (globalTemplates.length === 0) {
      console.log(
        `[HostelTemplate] No global templates found to copy for hostel ${hostelId}`
      );
      return;
    }

    // Prepare HostelTemplate documents
    const hostelTemplatesData = globalTemplates.map((gt) => ({
      hostelId: new Types.ObjectId(hostelId),
      globalTemplateId: gt._id,
      title: gt.title,
      slug: gt.slug,
      description: gt.description,
      hostelName,
      hostelCode,
      subcategories: gt.subcategories.map((sub: any) => ({
        _id: new Types.ObjectId(),
        originalSubcategoryId: sub._id
          ? new Types.ObjectId(sub._id)
          : undefined,
        title: sub.title,
        slug: sub.slug,
        description: sub.description,
        notificationTemplate: sub.notificationTemplate,
        isActive: sub.isActive,
      })),
      isActive: true,
      isDeleted: false,
    }));

    try {
      await HostelTemplate.insertMany(hostelTemplatesData, { ordered: false });
      console.log(
        `[HostelTemplate] Successfully initialized ${hostelTemplatesData.length} templates for hostel ${hostelId}`
      );
    } catch (error: any) {
      if (
        error.code === 11000 ||
        error.writeErrors?.some((e: any) => e.code === 11000)
      ) {
        console.log(
          `[HostelTemplate] Templates already partially existed for hostel ${hostelId}, skipped duplicates.`
        );
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    console.error(
      `[HostelTemplate] Failed to initialize templates for hostel ${hostelId}:`,
      error
    );
  }
};

//here we are getting hostel templates summary with all required details
const getHostelTemplatesSummary = async (
  hostelId?: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const hostelMatchStage: any = { status: true };
    if (hostelId && Types.ObjectId.isValid(hostelId)) {
      hostelMatchStage._id = new Types.ObjectId(hostelId);
    }

    const aggregatePipeline: any[] = [
      { $match: hostelMatchStage },

      //Lookup HostelTemplates for this hostel
      {
        $lookup: {
          from: "hosteltemplates",
          let: { hostelId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$hostelId", "$$hostelId"] },
                isDeleted: false,
              },
            },
          ],
          as: "hostelTemplates",
        },
      },

      //Calculate counts
      {
        $addFields: {
          templateCount: { $size: "$hostelTemplates" },
          subCategoryCount: {
            $sum: {
              $map: {
                input: "$hostelTemplates",
                as: "template",
                in: {
                  $cond: {
                    if: { $isArray: "$$template.subcategories" },
                    then: { $size: "$$template.subcategories" },
                    else: 0,
                  },
                },
              },
            },
          },
        },
      },

      //Project final structure
      {
        $project: {
          _id: 0,
          hostelId: "$_id",
          hostelName: "$name",
          hostelCode: "$identifier",
          status: "$status",
          templateCount: 1,
          subCategoryCount: 1,
        },
      },

      //Sort by hostel name
      { $sort: { hostelName: 1 } },
    ];

    const options = {
      page,
      limit,
    };

    // Use aggregatePaginate
    const result: any = await (Hostel as any).aggregatePaginate(
      Hostel.aggregate(aggregatePipeline),
      options
    );

    return {
      totalHostels: result.totalDocs,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      data: result.docs,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to retrieve hostel templates summary: ${error.message}`
    );
  }
};

//  Get all categories with subcategories for a hostel, split by applied/not-applied status.
const getHostelCategoriesForEdit = async (hostelId: string) => {
  try {
    if (!Types.ObjectId.isValid(hostelId)) {
      throw new Error("Invalid hostelId");
    }

    const hostelObjectId = new Types.ObjectId(hostelId);

    // Fetch applied categories (HostelTemplates for this hostel)
    const appliedCategories = await HostelTemplate.find({
      hostelId: hostelObjectId,
      isDeleted: false,
    })
      .select(
        "_id globalTemplateId title slug description subcategories isActive"
      )
      .lean();

    // Get the globalTemplateIds that are already applied
    const appliedGlobalTemplateIds = appliedCategories.map((cat) =>
      cat.globalTemplateId.toString()
    );

    // Fetch all global templates
    const allGlobalTemplates = await GlobalTemplate.find({
      scope: "global",
      isDeleted: false,
      isActive: true,
    })
      .select("_id title slug description subcategories isActive")
      .lean();

    // Split into applied and not applied
    const applied = appliedCategories.map((cat) => ({
      _id: cat._id,
      categoryId: cat.globalTemplateId,
      categoryTitle: cat.title,
      slug: cat.slug,
      description: cat.description,
      subcategories: cat.subcategories,
      isActive: cat.isActive,
      applied: true,
    }));

    const notApplied = allGlobalTemplates
      .filter((gt) => !appliedGlobalTemplateIds.includes(gt._id.toString()))
      .map((gt) => ({
        _id: gt._id,
        categoryId: gt._id,
        categoryTitle: gt.title,
        slug: gt.slug,
        description: gt.description,
        subcategories: gt.subcategories,
        isActive: gt.isActive,
        applied: false,
      }));

    return {
      applied,
      notApplied,
      totalApplied: applied.length,
      totalNotApplied: notApplied.length,
    };
  } catch (error: any) {
    throw new Error(`Failed to retrieve categories: ${error.message}`);
  }
};

//Add a SPECIFIC subcategory (by ID) from Global Template to Hostel Template.
const addSubcategoryToHostelTemplate = async (
  hostelId: string,
  globalTemplateId: string,
  subcategoryId: string,
  hostelName?: string,
  hostelCode?: string
) => {
  try {
    if (!Types.ObjectId.isValid(hostelId)) {
      throw new Error("Invalid hostelId");
    }
    if (!Types.ObjectId.isValid(globalTemplateId)) {
      throw new Error("Invalid globalTemplateId");
    }
    if (!Types.ObjectId.isValid(subcategoryId)) {
      throw new Error("Invalid subcategoryId");
    }

    const hostelObjectId = new Types.ObjectId(hostelId);
    const globalTemplateObjectId = new Types.ObjectId(globalTemplateId);

    //Fetch Global Template to get the source subcategory
    const globalTemplate = await GlobalTemplate.findOne({
      _id: globalTemplateObjectId,
      scope: "global",
      isDeleted: false,
      isActive: true,
    }).lean();

    if (!globalTemplate) {
      throw new Error("Global template not found or inactive");
    }

    // Find the specific subcategory to copy
    const targetSubcategory = globalTemplate.subcategories.find(
      (sub: any) => sub._id.toString() === subcategoryId
    );

    if (!targetSubcategory) {
      throw new Error("Subcategory not found in the global template");
    }

    // Check if HostelTemplate exists for this category
    let hostelTemplate = await HostelTemplate.findOne({
      hostelId: hostelObjectId,
      globalTemplateId: globalTemplateObjectId,
      isDeleted: false,
    });

    const newHostelSubcategory = {
      _id: new Types.ObjectId(),
      originalSubcategoryId: targetSubcategory._id,
      title: targetSubcategory.title,
      slug: targetSubcategory.slug,
      description: targetSubcategory.description,
      isActive: targetSubcategory.isActive,
      notificationTemplate: targetSubcategory.notificationTemplate,
    };

    // If category not applied to hostel, create it with SINGLE subcategory
    if (!hostelTemplate) {
      const hostelTemplateData = {
        hostelId: hostelObjectId,
        globalTemplateId: globalTemplate._id,
        title: globalTemplate.title,
        slug: globalTemplate.slug,
        description: globalTemplate.description,
        hostelName,
        hostelCode,
        subcategories: [newHostelSubcategory],
        isActive: true,
        isDeleted: false,
      };

      hostelTemplate = await HostelTemplate.create(hostelTemplateData);

      return {
        success: true,
        hostelTemplate,
        newSubcategory: newHostelSubcategory,
        categoryWasCreated: true,
      };
    }

    // If category exists, append subcategory if not duplicate
    // Check duplication by originalSubcategoryId (best) or slug
    const isDuplicate = hostelTemplate.subcategories.some(
      (sub: any) =>
        (sub.originalSubcategoryId &&
          sub.originalSubcategoryId.toString() === subcategoryId) ||
        sub.slug === targetSubcategory.slug
    );

    if (isDuplicate) {
      throw new Error("This subcategory is already applied to this hostel");
    }

    // Add subcategory to HostelTemplate
    const updatedTemplate = await HostelTemplate.findByIdAndUpdate(
      hostelTemplate._id,
      {
        $push: { subcategories: newHostelSubcategory },
      },
      { new: true }
    );

    return {
      success: true,
      hostelTemplate: updatedTemplate,
      newSubcategory: newHostelSubcategory,
      categoryWasCreated: false,
    };
  } catch (error: any) {
    console.error(`[HostelTemplate] Failed to add subcategory:`, error);
    throw new Error(error.message || "Failed to add subcategory");
  }
};

export default {
  upsertHostelTemplate,
  initializeHostelTemplates,
  getHostelTemplatesSummary,
  getHostelCategoriesForEdit,
  addSubcategoryToHostelTemplate,
};
