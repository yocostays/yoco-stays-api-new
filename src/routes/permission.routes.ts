import { Router } from "express";
import PermissionController from "../controllers/permission.controller";
const { addPermissionToRole, fetchPermissionByStaffRoleId } =
  PermissionController;
import validateToken from "../middlewares/validateToken";
import { checkSuperAdmin } from "../middlewares/checkSuperAdmin";

const permissionRouter = Router();

//fetch permission by staff role id
permissionRouter.post("/", validateToken, fetchPermissionByStaffRoleId);

//add permission to role id
permissionRouter.post(
  "/create",
  validateToken,
  checkSuperAdmin,
  addPermissionToRole,
);

export default permissionRouter;
