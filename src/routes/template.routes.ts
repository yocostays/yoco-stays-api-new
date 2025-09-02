import { Router } from "express";
import TemplateController from "../controllers/template.controller";
const {
  createNewTemplate,
  getAllTemplate,
  getTemplateById,
  updateTemplateDetails,
} = TemplateController;
import validateToken from "../middlewares/validateToken";

const templateRouter = Router();

templateRouter.post("/create", validateToken, createNewTemplate);
templateRouter.get("/", validateToken, getAllTemplate);
templateRouter.get("/:id", validateToken, getTemplateById);
templateRouter.patch("/update/:id", validateToken, updateTemplateDetails);

export default templateRouter;
