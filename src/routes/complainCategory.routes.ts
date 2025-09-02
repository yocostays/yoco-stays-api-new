import { Router } from "express";
import ComplainCategoryController from "../controllers/complainCategory.controller";
const { createNewComplainCategory, getAllComplainCategory } =
  ComplainCategoryController;
import validateToken from "../middlewares/validateToken";

const complainCategoryRouter = Router();

complainCategoryRouter.post(
  "/create",
  validateToken,
  createNewComplainCategory
);
complainCategoryRouter.post("/", validateToken, getAllComplainCategory);

export default complainCategoryRouter;
