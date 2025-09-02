import { Router } from "express";
import NoticeController from "../controllers/notice.controller";
const { createNotice, getAllNotice } = NoticeController;
import validateToken from "../middlewares/validateToken";

const noticeRouter = Router();

noticeRouter.post("/create", validateToken, createNotice);
noticeRouter.get("/", validateToken, getAllNotice);

export default noticeRouter;
