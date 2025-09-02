import { Router } from "express";
import RoleController from "../controllers/role.controller";
const {
  createNewRole,
  getAllRolesWithPagination,
  getRoleById,
  updateRoleDetails,
  deleteRoleById,
  getRoleByName,
  getAllRolesWithoutSuperAdmin,
  getAllRolesForWardenPanel
} = RoleController;
import validateToken from "../middlewares/validateToken";

const roleRouter = Router();

roleRouter.post("/create", validateToken, createNewRole);
roleRouter.get("/", validateToken, getAllRolesWithPagination);
roleRouter.get("/:id", validateToken, getRoleById);
roleRouter.patch("/update/:id", validateToken, updateRoleDetails);
roleRouter.delete("/delete/:id", validateToken, deleteRoleById);
roleRouter.post("/get-by-name", validateToken, getRoleByName);
roleRouter.post(
  "/exclude-superadmin",
  validateToken,
  getAllRolesWithoutSuperAdmin
);
roleRouter.post("/warden-access", validateToken, getAllRolesForWardenPanel);

export default roleRouter;
