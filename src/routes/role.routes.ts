import { Router } from "express";
import RoleController from "../controllers/role.controller";
import { checkSuperAdmin } from "../middlewares/checkSuperAdmin";
import validateToken from "../middlewares/validateToken";

const {
  createRole,
  createCategory,
  getAllCategories,
  getAllRoles,
  getRoleById,
  updateCategory,
  deleteRoleById,
  getRoleByName,
  getAllRolesWithoutSuperAdmin,
  getAllRolesForWardenPanel,
} = RoleController;

const roleRouter = Router();

// ------------------------routes for role categories--------------------------------------------------------------

//SECTION: Route to create a new role category
roleRouter.post(
  "/create-category",
  validateToken,
  checkSuperAdmin,
  createCategory,
);

//SECTION: Route to get all role categories
roleRouter.get("/categories", validateToken, checkSuperAdmin, getAllCategories);

//SECTION: Route to update a role category
roleRouter.patch(
  "/update-category/:id",
  validateToken,
  checkSuperAdmin,
  updateCategory,
);

// --------------------------------routes for roles-----------------------------------------------------------------

//SECTION: Route to get all roles with pagination
roleRouter.post("/", validateToken, checkSuperAdmin, getAllRoles);

//SECTION: Route to create a new role
roleRouter.post("/create-role", validateToken, checkSuperAdmin, createRole);

// ----------------------------------------------------------------------------------------------------------------

roleRouter.get("/:id", validateToken, getRoleById);

roleRouter.delete(
  "/delete/:id",
  validateToken,
  checkSuperAdmin,
  deleteRoleById,
);
roleRouter.post("/get-by-name", validateToken, getRoleByName);
roleRouter.post(
  "/exclude-superadmin",
  validateToken,
  getAllRolesWithoutSuperAdmin,
);
roleRouter.post("/warden-access", validateToken, getAllRolesForWardenPanel);

export default roleRouter;
