import { Router } from "express";
import validateToken from "../middlewares/validateToken";
import { checkSuperAdmin } from "../middlewares/checkSuperAdmin";
import GlobalTemplateController from "../controllers/globalTemplate.controller";
import TemplateController from "../controllers/template.controller";

const {
  createTempletCategories,
  getAllCategories,
  createSubcategory,
  getHostelTemplatesSummary,
  getHostelCategoriesForEdit,
  addSubcategoryToHostelTemplate,
  deleteGlobalCategory,
  deleteGlobalSubcategory,
  updateSubcategoryMessage,
} = GlobalTemplateController;

const {
  createNewTemplate,
  getAllTemplate,
  getTemplateById,
  updateTemplateDetails,
} = TemplateController;

const templateRouter = Router();

// Global Category Routes (Specific) - Superadmin Only
//1. this is for creaeting global template categories
templateRouter.post(
  "/create-category",
  validateToken,
  checkSuperAdmin,
  createTempletCategories
);
templateRouter.get(
  "/get-categories",
  validateToken,
  checkSuperAdmin,
  getAllCategories
); //get all categories with subcategories
templateRouter.post(
  "/create-subcategories",
  validateToken,
  checkSuperAdmin,
  createSubcategory
); //create subcategory under specific category
//here we are deleting global category and all its subcategories if any hostel are not using them
templateRouter.delete(
  "/delete-category/:categoryId",
  validateToken,
  checkSuperAdmin,
  deleteGlobalCategory
);

templateRouter.delete(
  "/delete-subcategory",
  validateToken,
  checkSuperAdmin,
  deleteGlobalSubcategory
);

// Hostel Templates Summary Route for hostel list view - Superadmin Only
templateRouter.post(
  "/hostel-templates/details",
  validateToken,
  checkSuperAdmin,
  getHostelTemplatesSummary
);

// Hostel Categories for Edit Route - Superadmin Only
templateRouter.get(
  "/hostel/:hostelId/categories",
  validateToken,
  checkSuperAdmin,
  getHostelCategoriesForEdit
);

// Add not applied Subcategory to Hostel Template Route (auto-creates category if needed) - Superadmin Only
templateRouter.post(
  "/hostel/add-subcategory",
  validateToken,
  checkSuperAdmin,
  addSubcategoryToHostelTemplate
);

// Update Applied Subcategory Message Route - Superadmin Only
templateRouter.patch(
  "/hostel/subcategory/update-message",
  validateToken,
  checkSuperAdmin,
  updateSubcategoryMessage
);

// Template Routes (Generic/Parameterized)
templateRouter.post("/create", validateToken, createNewTemplate);
templateRouter.get("/", validateToken, getAllTemplate);
templateRouter.get("/:id", validateToken, getTemplateById);
templateRouter.patch("/update/:id", validateToken, updateTemplateDetails);

export default templateRouter;
