import { Router } from "express";
import RoutesController from "../controllers/routes.controller";
import validateToken from "../middlewares/validateToken";
import { checkSuperAdmin } from "../middlewares/checkSuperAdmin";

const { createNewRoutes, getAllRoutes, deleteRouteById, updateRouteById } =
  RoutesController;

const pageRoutesRouter = Router();

//Create a new route(module)
pageRoutesRouter.post(
  "/create",
  validateToken,
  checkSuperAdmin,
  createNewRoutes,
);
pageRoutesRouter.get("/", validateToken, checkSuperAdmin, getAllRoutes);
pageRoutesRouter.patch(
  "/update/:id",
  validateToken,
  checkSuperAdmin,
  updateRouteById,
);
pageRoutesRouter.delete(
  "/delete/:id",
  validateToken,
  checkSuperAdmin,
  deleteRouteById,
);

export default pageRoutesRouter;
