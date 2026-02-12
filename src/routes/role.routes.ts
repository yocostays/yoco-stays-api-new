import { Router } from "express";
import RoleController from "../controllers/role.controller";
import validateToken from "../middlewares/validateToken";
import { checkSuperAdmin } from "../middlewares/checkSuperAdmin";

const {
  createCategory,
  getAllCategoryWithPagination,
  getRoleById,
  updateCategory,
  deleteRoleById,
  getRoleByName,
  getAllRolesWithoutSuperAdmin,
  getAllRolesForWardenPanel,
} = RoleController;

const roleRouter = Router();

roleRouter.post(
  "/create-category",
  validateToken,
  checkSuperAdmin,
  createCategory,
);

roleRouter.get("/", validateToken, getAllCategoryWithPagination);

roleRouter.get("/:id", validateToken, getRoleById);
roleRouter.patch(
  "/update-category/:id",
  validateToken,
  checkSuperAdmin,
  updateCategory,
);
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
