import { Router } from "express";
import HostelController from "../controllers/hostel.controller";
import validateToken from "../middlewares/validateToken";
import { uploadFileWithMulter } from "../utils/configureMulterStorage";
const {
  createHostelInAdmin,
  getHostelwithoutToken,
  getAllHostelWithPagination,
  getHosteldetailsById,
  deleteHostelById,
  updateHostelDetailsById,
  addOrUpdateRoomMappingDetails,
  fetchMapppedRoomDetails,
  fetchHostelDetailsForApp,
  fetchBedTypesByHostelId,
  getVacantRoomsByBedType,
  getRoomsByBedType,
  uploadLegalDocuments,
  retrivedUploadLegalDocuments,
  updateMessDetails,
  fetchHostelMessDetails,
  fetchFloorByBedTypeAndHostelId,
  fetchUserDetailsOfRoom,
  fetchPaymentOptionsByHostel,
  fetchRoomsByMulipleFloorNumbers,
  uploadRoomMappingInBulk,
} = HostelController;

const hostelRouter = Router();

hostelRouter.post("/create", validateToken, createHostelInAdmin);
hostelRouter.post("/web", getHostelwithoutToken); //TODO - will only use in app
hostelRouter.get("/", validateToken, getAllHostelWithPagination);
hostelRouter.get("/:id", validateToken, getHosteldetailsById);
hostelRouter.post("/delete/:id", validateToken, deleteHostelById);
hostelRouter.patch("/update/:id", validateToken, updateHostelDetailsById);
hostelRouter.post(
  "/rooms/configuration",
  validateToken,
  addOrUpdateRoomMappingDetails
);
hostelRouter.post("/fetch-mapped-room", validateToken, fetchMapppedRoomDetails);
hostelRouter.post("/details", validateToken, fetchHostelDetailsForApp); //TODO - will only use in app
hostelRouter.post("/bedTypes", validateToken, fetchBedTypesByHostelId);
hostelRouter.post(
  "/vacant-room-details",
  validateToken,
  getVacantRoomsByBedType
);
hostelRouter.post("/bed-type/rooms", validateToken, getRoomsByBedType);
hostelRouter.patch("/upload-documents", validateToken, uploadLegalDocuments);
hostelRouter.post("/documents", validateToken, retrivedUploadLegalDocuments);
hostelRouter.patch("/update-mess", validateToken, updateMessDetails);
hostelRouter.post("/fetch-mess", validateToken, fetchHostelMessDetails);
hostelRouter.post(
  "/fetch-floor",
  validateToken,
  fetchFloorByBedTypeAndHostelId
);
hostelRouter.post("/fetch-users", validateToken, fetchUserDetailsOfRoom);
hostelRouter.post(
  "/payment-methods",
  validateToken,
  fetchPaymentOptionsByHostel
);
hostelRouter.post(
  "/mupliple-floors/rooms",
  validateToken,
  fetchRoomsByMulipleFloorNumbers
);
hostelRouter.post(
  "/bulk-upload",
  uploadFileWithMulter.single("file"),
  validateToken,
  uploadRoomMappingInBulk
);
export default hostelRouter;
