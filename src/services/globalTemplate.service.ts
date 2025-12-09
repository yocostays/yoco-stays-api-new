import GlobalTemplate, { IGlobalTemplate, ISubcategory } from "../models/globalTemplate.model";
import { FilterQuery, Types } from "mongoose";
import { toSlug } from "../utils/slug";

export class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateError";
  }
}

//this function creates a new global template category
const createGlobalTemplate = async (data: Partial<IGlobalTemplate>) => {

  const slug = toSlug(data.title || "");
  
  if (!slug) throw new Error("Invalid title for slug generation");


  const exists = await GlobalTemplate.findOne({
    $or: [
        { slug },
        { title: { $regex: new RegExp(`^${data.title}$`, "i") } } 
    ],
    scope: data.scope,
    hostelId: data.scope === "hostel" ? data.hostelId : null,
    isDeleted: false,
  });

  if (exists) {
    throw new DuplicateError("Category already exists (Slug or Title conflict)");
  }


  const template = new GlobalTemplate({
    ...data,
    slug, 
  });

  return await template.save();
};

//this function gets all global templates based on a query
const getGlobalTemplates = async (query: FilterQuery<IGlobalTemplate> = {}) => {
  return await GlobalTemplate.find({ ...query, isDeleted: false }).sort({ createdAt: -1 });
};

//this function gets a global template by its ID
const getGlobalTemplateById = async (id: string) => {
  return await GlobalTemplate.findOne({ _id: id, isDeleted: false });
};


//This function adds a subcategory to an existing global template category
const addSubcategory = async (categoryId: string, subcategoryData: Partial<ISubcategory>) => {
  if (!Types.ObjectId.isValid(categoryId)) {
    throw new Error("Invalid Category ID");
  }

  const slug = toSlug(subcategoryData.title || "");
  if (!slug) throw new Error("Invalid title for slug generation");

  const newSubcategory = {
    _id: new Types.ObjectId(),
    ...subcategoryData,
    slug,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Atomic Update: Push only if slug doesn't exist in subcategories
  const updatedCategory = await GlobalTemplate.findOneAndUpdate(
    {
      _id: categoryId,
      isDeleted: false,
      "subcategories.slug": { $ne: slug }
    },
    {
      $push: { subcategories: newSubcategory }
    },
    { new: true }
  );

  if (!updatedCategory) {
    const categoryExists = await GlobalTemplate.findOne({ _id: categoryId, isDeleted: false });
    
    if (!categoryExists) {
        return null; 
    }

    const existingSub = categoryExists.subcategories.find(sub => sub.slug === slug);
    throw new DuplicateError(existingSub ? JSON.stringify(existingSub) : "Subcategory conflict"); 
  }

  return { updatedCategory, newSubcategory };
};


// This function deletes a global template category if not used in any hostel
const deleteGlobalTemplate = async (categoryId: string) => {
  if (!Types.ObjectId.isValid(categoryId)) {
    throw new Error("Invalid category ID");
  }

  const category = await GlobalTemplate.findOne({
    _id: categoryId,
    isDeleted: false
  });

  if (!category) {
    throw new Error("Category not found or already deleted");
  }

  // Import HostelTemplate to check usage
  const { default: HostelTemplate } = await import("../models/hostelTemplate.model");

  // Check if category is used in any hostel
  const usageCount = await HostelTemplate.countDocuments({
    globalTemplateId: categoryId,
    isDeleted: false
  });

  if (usageCount > 0) {
    throw new Error(`Cannot delete category. It is currently used in ${usageCount} hostel(s)`);
  }

  const deletedCategory = await GlobalTemplate.findByIdAndDelete(categoryId);

  return {
    success: true,
    message: "Category deleted successfully",
    category: deletedCategory
  };
};

export default {
  createGlobalTemplate,
  getGlobalTemplates,
  getGlobalTemplateById,
  addSubcategory,
  deleteGlobalTemplate,
};
