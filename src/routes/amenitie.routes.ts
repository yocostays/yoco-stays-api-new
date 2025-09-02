import { Router } from "express";
import AmenitiesController from "../controllers/amenities.controller";
const {
  createNewAmenities,
  getAllAmenitiesWithPagination,
  getAmenitieById,
  updateAmenitieDetails,
  deleteAmenitieById,
  getAmenitieByName,
} = AmenitiesController;
import validateToken from "../middlewares/validateToken";

const amenitieRouter = Router();

amenitieRouter.post("/create", validateToken, createNewAmenities);
amenitieRouter.get("/", validateToken, getAllAmenitiesWithPagination);
amenitieRouter.get("/:id", validateToken, getAmenitieById);
amenitieRouter.patch("/update/:id", validateToken, updateAmenitieDetails);
amenitieRouter.delete("/delete/:id", validateToken, deleteAmenitieById);
amenitieRouter.post("/get-by-name", validateToken, getAmenitieByName);

export default amenitieRouter;
