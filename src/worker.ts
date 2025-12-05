import mongoose from "mongoose";
import * as dotenv from "dotenv";
import { startEmailWorker } from "./services/emailWorker.service";
import { verifyConnection } from "./services/mailService";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "";

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    
    // Verify SMTP at startup
    await verifyConnection();
    
    startEmailWorker();
  })
  .catch((err) => {
    process.exit(1);
  });
