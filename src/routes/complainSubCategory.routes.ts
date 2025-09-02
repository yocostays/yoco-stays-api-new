import { Router } from "express";
import ComplainSubCategoryController from "../controllers/complainSubCategory.controller";
const { createNewComplainSubCategory, getAllComplainSubCategory } = ComplainSubCategoryController;

import validateToken from "../middlewares/validateToken";

const complainSubCategoryRouter = Router();

complainSubCategoryRouter.post("/create", createNewComplainSubCategory);
complainSubCategoryRouter.post("/", validateToken, getAllComplainSubCategory);

export default complainSubCategoryRouter;
