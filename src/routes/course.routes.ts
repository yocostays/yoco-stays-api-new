import { Router } from "express";
import CourseController from "../controllers/course.controller";
const {
  createNewCourse,
  getAllCoursesWithPagination,
  getCourseById,
  updateCourseDetails,
  deleteCourseById,
  getCourseByName,
} = CourseController;
import validateToken from "../middlewares/validateToken";

const courseRouter = Router();

courseRouter.post("/create", validateToken, createNewCourse);
courseRouter.get("/", validateToken, getAllCoursesWithPagination);
courseRouter.get("/:id", validateToken, getCourseById);
courseRouter.patch("/update/:id", validateToken, updateCourseDetails);
courseRouter.delete("/delete/:id", validateToken, deleteCourseById);
courseRouter.post("/get-by-name", validateToken, getCourseByName);

export default courseRouter;
