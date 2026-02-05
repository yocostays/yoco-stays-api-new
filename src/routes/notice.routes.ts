import { Router } from "express";
import NoticeController from "../controllers/notice.controller";
const {
  createNotice,
  getAllNotice,
  markNotificationsAsRead,
  getUserNotifications,
} = NoticeController;
import validateToken from "../middlewares/validateToken";

const noticeRouter = Router();

noticeRouter.post("/create", validateToken, createNotice);
noticeRouter.get("/", validateToken, getAllNotice);

//-------------student notifications routes-------------------------------------------

// Get notifications for the authenticated user
noticeRouter.get("/notifications", validateToken, getUserNotifications);

// Mark notifications as read for the authenticated user
noticeRouter.patch(
  "/notifications/mark-read",
  validateToken,
  markNotificationsAsRead,
);

export default noticeRouter;
