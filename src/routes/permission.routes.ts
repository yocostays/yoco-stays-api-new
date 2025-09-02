import { Router } from "express";
import PermissionController from "../controllers/permission.controller";
const { addPermissionToRole,fetchPermissionByStaffRoleId } = PermissionController;
import validateToken from "../middlewares/validateToken";

const permissionRouter = Router();

permissionRouter.post("/",validateToken, fetchPermissionByStaffRoleId);
permissionRouter.post("/create",validateToken, addPermissionToRole);

export default permissionRouter;
