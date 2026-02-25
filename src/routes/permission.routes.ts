import { Router } from "express";
import PermissionController from "../controllers/permission.controller";
const {
  addPermissionToRole,
  fetchPermissionByStaffRoleId,
  getRolesHostelWise,
  addCustomPermissionToRole,
  fetchCustomPermissionByHostelAndRole,
  fetchUserPermissionsWeb,
  fetchUserPermissionsMobile,
} = PermissionController;
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

// --------------------This API is used for CUSTOM PERNISSIONs--------------------

//fetch roles hostel wise
permissionRouter.post("/hostel-roles", validateToken, getRolesHostelWise);

//create custom permission (hostel wise)
permissionRouter.post(
  "/create-custom",
  validateToken,
  checkSuperAdmin,
  addCustomPermissionToRole,
);

//fetch custom permission (hostel wise)
permissionRouter.post(
  "/fetch-custom",
  validateToken,
  fetchCustomPermissionByHostelAndRole,
);

//fetch user permissions for web (after login)
permissionRouter.get(
  "/fetch-user-permissions",
  validateToken,
  fetchUserPermissionsWeb,
);

//fetch user permissions for mobile (after login)
permissionRouter.get(
  "/fetch-user-permissions-mobile",
  validateToken,
  fetchUserPermissionsMobile,
);

export default permissionRouter;
