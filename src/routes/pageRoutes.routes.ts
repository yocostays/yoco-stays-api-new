import { Router } from "express";
import RoutesController from "../controllers/routes.controller";
const { createNewRoutes, getAllRoutes, deleteRouteById } = RoutesController;
import validateToken from "../middlewares/validateToken";

const pageRoutesRouter = Router();

pageRoutesRouter.post("/create", createNewRoutes);
pageRoutesRouter.get("/", validateToken, getAllRoutes);
pageRoutesRouter.delete("/delete/:id", validateToken, deleteRouteById);

export default pageRoutesRouter;
