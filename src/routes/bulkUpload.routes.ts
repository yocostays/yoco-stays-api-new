import { Router } from "express";
import BulkUploadController from "../controllers/bulkUpload.controller";
const { getAllBulkUploadFiles } = BulkUploadController;
import validateToken from "../middlewares/validateToken";

const bulkUploadRoutes = Router();

bulkUploadRoutes.get("/", validateToken, getAllBulkUploadFiles);

export default bulkUploadRoutes;
