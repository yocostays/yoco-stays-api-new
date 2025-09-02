import multer from "multer";

//NOTE: Configure multer for file storage (example: in memory)
const storage = multer.memoryStorage();
export const uploadFileWithMulter = multer({ storage });
