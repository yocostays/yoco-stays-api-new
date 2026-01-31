import { Router } from "express";
import FoodWastageController from "../controllers/foodWastage.controller";
const {
  createFoodWastage,
  getAllFoodWastage,
  getFoodWastageById,
  updateFoodWastage,
  deleteFoodWastageById,
  foodWastageBulkUpload,
  getDateWastage
} = FoodWastageController;
import { uploadFileWithMulter } from "../utils/configureMulterStorage";
import validateToken from "../middlewares/validateToken";

const foodWastageRouter = Router();
//using this route we can add and update food wastage details
foodWastageRouter.post("/create", validateToken, createFoodWastage);
foodWastageRouter.post("/", validateToken, getAllFoodWastage);
foodWastageRouter.get("/:id", validateToken, getFoodWastageById);
foodWastageRouter.patch("/update/:id", validateToken, updateFoodWastage);
foodWastageRouter.delete("/delete/:id", validateToken, deleteFoodWastageById);
foodWastageRouter.post(
    "/bulk-upload",
    uploadFileWithMulter.single("file"),
    validateToken,
    foodWastageBulkUpload
  );

  //get wastage count datewise
  foodWastageRouter.post("/get-wastage", validateToken, getDateWastage);
export default foodWastageRouter;
