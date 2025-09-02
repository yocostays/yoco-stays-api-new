import { Router } from "express";
import FoodWastageController from "../controllers/foodWastage.controller";
const {
    createFoodWastage,
    getAllFoodWastage,
    getFoodWastageById,
    updateFoodWastage,
    deleteFoodWastageById,
    foodWastageBulkUpload
} = FoodWastageController;
import { uploadFileWithMulter } from "../utils/configureMulterStorage";
import validateToken from "../middlewares/validateToken";

const foodWastageRouter = Router();

foodWastageRouter.post("/create", validateToken, createFoodWastage);
foodWastageRouter.get("/", validateToken, getAllFoodWastage);
foodWastageRouter.get("/:id", validateToken, getFoodWastageById);
foodWastageRouter.patch("/update/:id", validateToken, updateFoodWastage);
foodWastageRouter.delete("/delete/:id", validateToken, deleteFoodWastageById);
foodWastageRouter.post(
    "/bulk-upload",
    uploadFileWithMulter.single("file"),
    validateToken,
    foodWastageBulkUpload
  );
export default foodWastageRouter;
