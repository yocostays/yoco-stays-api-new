import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";

// Explicitly load .env from project root (assuming dist/worker.js -> ../.env)
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

import { startEmailWorker } from "./services/emailWorker.service";
import { verifyConnection } from "./services/mailService";

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
