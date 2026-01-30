import { Router } from "express";
import AnnouncementController from "../controllers/announcement.controller";
import validateToken from "../middlewares/validateToken";
import { uploadFileWithMulter } from "../utils/configureMulterStorage";

const {
  createAnnouncement,
  updateAnnouncement,
  getAnnouncementsForWarden,
  deleteAnnouncement,
} = AnnouncementController;

const announcementRouter = Router();

// Warden routes
//get announcements for warden
announcementRouter.post("/list", validateToken, getAnnouncementsForWarden);

//create announcement routes for warden
announcementRouter.post(
  "/",
  validateToken,
  uploadFileWithMulter.fields([
    { name: "images", maxCount: 5 },
    { name: "attachment", maxCount: 1 },
  ]),
  createAnnouncement,
);

//update announcement routes for warden
announcementRouter.put(
  "/:id",
  validateToken,
  uploadFileWithMulter.fields([
    { name: "images", maxCount: 5 },
    { name: "attachment", maxCount: 1 },
  ]),
  updateAnnouncement,
);

//delete announcement routes for warden
announcementRouter.delete("/:id", validateToken, deleteAnnouncement);

export default announcementRouter;
