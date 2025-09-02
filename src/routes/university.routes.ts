import { Router } from "express";
import UniversityController from "../controllers/university.controller";
const {
  createNewCollege,
  getAllCollegesWithPagination,
  getCollegeById,
  deleteCollegeById,
  updateCollegeDetails,
  allUniversityWithoutPagination,
  courseDetailsByUniversityId
} = UniversityController;
import validateToken from "../middlewares/validateToken";

const universityRouter = Router();

universityRouter.post("/create", validateToken, createNewCollege);
universityRouter.get("/", validateToken, getAllCollegesWithPagination);
universityRouter.get("/:id", validateToken, getCollegeById);
universityRouter.post("/delete/:id", validateToken, deleteCollegeById);
universityRouter.patch("/update/:id", validateToken, updateCollegeDetails);
universityRouter.post("/list", validateToken, allUniversityWithoutPagination);
universityRouter.post("/courses", validateToken, courseDetailsByUniversityId);


export default universityRouter;
