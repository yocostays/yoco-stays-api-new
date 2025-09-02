import { Router } from "express";
import LeaveCategoryController from "../controllers/leaveCategory.controller";
const { createNewLeaveCategory, getAllLeaveCategory } = LeaveCategoryController;
import validateToken from "../middlewares/validateToken";

const leaveCategoryRouter = Router();

leaveCategoryRouter.post("/create", validateToken, createNewLeaveCategory);
leaveCategoryRouter.post("/", validateToken, getAllLeaveCategory);

export default leaveCategoryRouter;
