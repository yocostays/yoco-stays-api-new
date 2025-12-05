import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";

// Explicitly load .env from project root (assuming dist/worker.js -> ../.env)
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

console.log("Worker Process Started");
console.log("Loading .env from:", envPath);
console.log("EMAIL_HOST:", process.env.EMAIL_HOST || "(MISSING)");
console.log("EMAIL_USER:", process.env.EMAIL_USER || "(MISSING)");

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
