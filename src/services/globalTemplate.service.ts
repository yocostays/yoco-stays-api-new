import GlobalTemplate, {
  IGlobalTemplate,
  ISubcategory,
} from "../models/globalTemplate.model";
import { FilterQuery, Types } from "mongoose";
import { toSlug } from "../utils/slug";
import { ERROR_MESSAGES } from "../utils/messages";
import { error } from "console";

const { DUPLICATE_RECORD } = ERROR_MESSAGES;

//this function creates a new global template category or updates existing one
const createGlobalTemplate = async (data: Partial<IGlobalTemplate>) => {
  const isUpdate = !!data._id;
  const categoryId = data._id;

  const slug = toSlug(data.title || "");

  if (!slug) throw new Error("Invalid title for slug generation");

  const scope = data.scope || "global";
  const hostelId = scope === "hostel" ? data.hostelId : null;

  const escapedTitle = data.title?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const duplicateQuery: any = {
    $or: [
      { slug },
      { title: { $regex: new RegExp(`^${escapedTitle}$`, "i") } },
    ],
    scope,
    hostelId,
    isDeleted: false,
  };

  // If updating, exclude the current category from duplicate check
  if (isUpdate) {
    duplicateQuery._id = { $ne: categoryId };
  }

  const exists = await GlobalTemplate.findOne(duplicateQuery);

  if (exists) {
    throw new Error(DUPLICATE_RECORD("category title or slug"));
  }

  // UPDATE existing category
  if (isUpdate) {
    if (!Types.ObjectId.isValid(categoryId as string)) {
      throw new Error("Invalid category ID for update");
    }

    const existingCategory = await GlobalTemplate.findOne({
      _id: categoryId,
      isDeleted: false,
    });

    if (!existingCategory) {
      throw new Error("Category not found or already deleted");
    }

    const { subcategories, ...updateData } = data;

    const updatedCategory = await GlobalTemplate.findByIdAndUpdate(
      categoryId,
      {
        $set: {
          ...updateData,
          slug,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    // If subcategories provided, handle them safely (preserving IDs)
    if (
      subcategories &&
      Array.isArray(subcategories) &&
      subcategories.length > 0
    ) {
      await bulkUpsertSubcategories([
        {
          categoryId: categoryId as string,
          subcategories: subcategories.map((sub: any) => ({
            ...sub,
            _id: sub._id ? sub._id.toString() : undefined,
          })),
        },
      ]);

      // refetch to return complete data
      return await GlobalTemplate.findById(categoryId);
    }

    return updatedCategory;
  }

  // CREATE new category
  const template = new GlobalTemplate({
    ...data,
    slug,
  });

  return await template.save();
};

//this function gets all global templates based on a query
const getGlobalTemplates = async (query: FilterQuery<IGlobalTemplate> = {}) => {
  const templates = await GlobalTemplate.find({ ...query, isDeleted: false })
    .sort({
      createdAt: -1,
    })
    .lean();

  if (templates.length === 0) {
    return [];
  }

  // Collect all subcategory IDs to check usage in one go
  const allSubcategoryIds: Types.ObjectId[] = [];
  const allTemplateIds: Types.ObjectId[] = [];

  templates.forEach((template) => {
    if (template._id) {
      allTemplateIds.push(template._id as any);
    }
    if (template.subcategories) {
      template.subcategories.forEach((sub: any) => {
        if (sub._id) {
          allSubcategoryIds.push(sub._id as any);
        }
      });
    }
  });

  // Import HostelTemplate dynamically to avoid circular dependency
  const { default: HostelTemplate } = await import(
    "../models/hostelTemplate.model"
  );

  // Check Subcategory Usage
  let usedSubcategoryIdsSet = new Set<string>();
  if (allSubcategoryIds.length > 0) {
    const usedSubcategories = await HostelTemplate.distinct(
      "subcategories.originalSubcategoryId",
      {
        "subcategories.originalSubcategoryId": { $in: allSubcategoryIds },
        isDeleted: false,
      }
    );
    usedSubcategoryIdsSet = new Set(
      usedSubcategories.map((id: any) => id.toString())
    );
  }

  // Check Main Category Usage
  let usedTemplateIdsSet = new Set<string>();
  if (allTemplateIds.length > 0) {
    const usedTemplates = await HostelTemplate.distinct("globalTemplateId", {
      globalTemplateId: { $in: allTemplateIds },
      isDeleted: false,
    });
    usedTemplateIdsSet = new Set(usedTemplates.map((id: any) => id.toString()));
  }

  // Map flags back to templates
  return templates.map((template) => ({
    ...template,
    // User Request: if main category used by any hostel make isActive true otherwise false
    isActive: usedTemplateIdsSet.has(template._id.toString()),
    subcategories:
      template.subcategories?.map((sub: any) => ({
        ...sub,
        canDelete: !usedSubcategoryIdsSet.has(sub._id.toString()),
      })) || [],
  }));
};

//this function gets a global template by its ID
const getGlobalTemplateById = async (id: string) => {
  return await GlobalTemplate.findOne({ _id: id, isDeleted: false });
};

//This function handles bulk create/update of subcategories across multiple categories
const bulkUpsertSubcategories = async (
  categoriesData: Array<{
    categoryId: string;
    subcategories: Array<{
      _id?: string;
      title: string;
      description?: string;
      isActive?: boolean;
    }>;
  }>
) => {
  const results: any[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  // Process each category
  for (const categoryData of categoriesData) {
    const { categoryId, subcategories } = categoryData;

    if (!Types.ObjectId.isValid(categoryId)) {
      failedCount += subcategories.length;
      results.push({
        categoryId,
        success: false,
        error: "Invalid category ID",
        subcategories: [],
      });
      continue;
    }

    // Fetch category once for all subcategories
    const category = await GlobalTemplate.findOne({
      _id: categoryId,
      isDeleted: false,
    });

    if (!category) {
      failedCount += subcategories.length;
      results.push({
        categoryId,
        success: false,
        error: "Category not found",
        subcategories: [],
      });
      continue;
    }

    const subcategoryResults: any[] = [];

    // Process each subcategory for this category
    for (const subData of subcategories) {
      try {
        const isUpdate = !!subData._id;
        const slug = toSlug(subData.title || "");

        if (!slug) {
          failedCount++;
          subcategoryResults.push({
            success: false,
            operation: "create",
            error: "Invalid title for slug generation",
            input: subData,
          });
          continue;
        }

        if (isUpdate) {
          // UPDATE existing subcategory
          if (!Types.ObjectId.isValid(subData._id as string)) {
            failedCount++;
            subcategoryResults.push({
              success: false,
              operation: "update",
              error: "Invalid subcategory ID",
              input: subData,
            });
            continue;
          }

          const subDoc = (category.subcategories as any).id(subData._id);

          if (!subDoc) {
            failedCount++;
            subcategoryResults.push({
              success: false,
              operation: "update",
              error: "Subcategory not found",
              input: subData,
            });
            continue;
          }

          // Check for duplicate slug (excluding current subcategory)
          const duplicateSlug = category.subcategories.some(
            (s: any) => s.slug === slug && s._id.toString() !== subData._id
          );

          if (duplicateSlug) {
            failedCount++;
            subcategoryResults.push({
              success: false,
              operation: "update",
              error: "Subcategory title already exists",
              input: subData,
            });
            continue;
          }

          // Direct property assignment to preserve ID and stability
          subDoc.title = subData.title.trim();
          subDoc.slug = slug;
          if (subData.description !== undefined) {
            subDoc.description = subData.description;
          }
          if (subData.isActive !== undefined) {
            subDoc.isActive = subData.isActive;
          }
          subDoc.updatedAt = new Date();

          updatedCount++;
          subcategoryResults.push({
            success: true,
            operation: "update",
            data: subDoc,
          });
        } else {
          // CREATE new subcategory

          const duplicateSlug = category.subcategories.some(
            (s: any) => s.slug === slug
          );

          if (duplicateSlug) {
            failedCount++;
            subcategoryResults.push({
              success: false,
              operation: "create",
              error: "Subcategory title already exists",
              input: subData,
            });
            continue;
          }

          const newSubcategory = {
            _id: new Types.ObjectId(),
            title: subData.title.trim(),
            slug,
            description: subData.description || "",
            isActive: subData.isActive !== false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          category.subcategories.push(newSubcategory);
          createdCount++;
          subcategoryResults.push({
            success: true,
            operation: "create",
            data: newSubcategory,
          });
        }
      } catch (error: any) {
        failedCount++;
        subcategoryResults.push({
          success: false,
          operation: subData._id ? "update" : "create",
          error: error.message,
          input: subData,
        });
      }
    }

    // Save category with all updated subcategories
    try {
      await category.save();
      results.push({
        categoryId,
        success: true,
        subcategories: subcategoryResults,
      });
    } catch (error: any) {
      results.push({
        categoryId,
        success: false,
        error: error.message,
        subcategories: subcategoryResults,
      });
    }
  }

  return {
    summary: {
      totalCategories: categoriesData.length,
      created: createdCount,
      updated: updatedCount,
      failed: failedCount,
    },
    results,
  };
};

// This function deletes a global template category if not used in any hostel
const deleteGlobalTemplate = async (categoryId: string) => {
  if (!Types.ObjectId.isValid(categoryId)) {
    throw new Error("Invalid category ID");
  }

  const category = await GlobalTemplate.findOne({
    _id: categoryId,
    isDeleted: false,
  });

  if (!category) {
    throw new Error("Category not found or already deleted");
  }

  // Import HostelTemplate to check usage
  const { default: HostelTemplate } = await import(
    "../models/hostelTemplate.model"
  );

  // Check if category is used in any hostel
  const usageCount = await HostelTemplate.countDocuments({
    globalTemplateId: categoryId,
    isDeleted: false,
  });

  if (usageCount > 0) {
    throw new Error(
      `Cannot delete category. It is currently used in ${usageCount} hostel(s)`
    );
  }

  const deletedCategory = await GlobalTemplate.findByIdAndDelete(categoryId);

  return {
    success: true,
    message: "Category deleted successfully",
    category: deletedCategory,
  };
};

// Delete a subcategory from a GLOBAL template.
const deleteGlobalSubcategory = async (
  categoryId: string,
  subcategoryId: string
) => {
  if (
    !Types.ObjectId.isValid(categoryId) ||
    !Types.ObjectId.isValid(subcategoryId)
  ) {
    throw new Error("Invalid ID(s) provided");
  }

  const category = await GlobalTemplate.findOne({
    _id: categoryId,
    isDeleted: false,
  });

  if (!category) {
    throw new Error("Global Category not found");
  }

  // Check if subcategory exists in the global template
  const subcategoryExists = category.subcategories.some(
    (sub: any) => sub._id.toString() === subcategoryId
  );

  if (!subcategoryExists) {
    throw new Error("Subcategory not found in this category");
  }

  const { default: HostelTemplate } = await import(
    "../models/hostelTemplate.model"
  );

  const usageCount = await HostelTemplate.countDocuments({
    "subcategories.originalSubcategoryId": new Types.ObjectId(subcategoryId),
    isDeleted: false,
  });

  if (usageCount > 0) {
    throw new Error(
      `Cannot delete subcategory. It is currently used in ${usageCount} hostel(s)`
    );
  }

  const updatedCategory = await GlobalTemplate.findOneAndUpdate(
    { _id: categoryId },
    { $pull: { subcategories: { _id: new Types.ObjectId(subcategoryId) } } },
    { new: true }
  );

  return {
    success: true,
    message: "Subcategory deleted successfully from Global Template",
    data: updatedCategory,
  };
};

export default {
  createGlobalTemplate,
  getGlobalTemplates,
  getGlobalTemplateById,
  bulkUpsertSubcategories,
  deleteGlobalTemplate,
  deleteGlobalSubcategory,
};
