import EmailQueue from "../models/emailQueue.model";
import { sendStudentWelcomeEmail } from "./mailService";
import os from "os";

const WORKER_ID = process.env.WORKER_ID || os.hostname();
const CONCURRENCY = parseInt(process.env.EMAIL_CONCURRENCY || "5");
const POLL_INTERVAL = 2000; // 2 seconds
const LEASE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const maxAttempts = 5; // Maximum retry attempts

// Helper: Sleep
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Calculate Backoff
const calculateBackoff = (attempts: number) => {
  // 1m, 2m, 4m, 8m, 16m... capped at 3 hours
  const backoffMs = Math.min(
    Math.pow(2, attempts) * 60 * 1000,
    3 * 60 * 60 * 1000
  );
  return new Date(Date.now() + backoffMs);
};

// Helper: Check if error is permanent
const isPermanentError = (error: any) => {
  const msg = error.message || "";
  // 5xx errors are usually permanent (e.g., 550 User not found)
  if (msg.includes("550") || msg.includes("554") || msg.includes("Invalid email")) {
    return true;
  }
  return false;
};

// Core: Process a single job
const processJob = async () => {
  // 1. Atomic Lock
  const job = await EmailQueue.findOneAndUpdate(
    {
      status: { $in: ["pending", "failed"] }, // Retry failed jobs too if they are due
      nextAttempt: { $lte: new Date() },
      attempts: { $lt: maxAttempts  }, // Hardcoded max check, real check below
    },
    {
      $set: {
        status: "processing",
        processingAt: new Date(),
        processingBy: WORKER_ID,
      },
    },
    { sort: { nextAttempt: 1 }, new: true }
  );

  if (!job) return false; // No job found

  try {
    // 2. Send Email
    const info = await sendStudentWelcomeEmail({
      email: job.email,
      name: job.name,
      uniqueId: job.uniqueId,
      plainPassword: job.plainPassword,
    });

    // 3. Verify Acceptance
    if (info.accepted && info.accepted.length > 0) {
      job.status = "sent";
      job.processingAt = undefined;
      job.processingBy = undefined;
      job.lastError = undefined;
      await job.save();
    } else {
      throw new Error(`SMTP Rejected: ${JSON.stringify(info.rejected)}`);
    }
  } catch (error: any) {
    job.attempts += 1;
    job.lastError = error.message;
    job.processingAt = undefined;
    job.processingBy = undefined;

    // 4. Handle Failure Type
    if (
      job.attempts >= job.maxAttempts ||
      isPermanentError(error)
    ) {
      job.status = "permanent_failed";
    } else {
      job.status = "failed"; // Will be picked up again when nextAttempt is reached
      job.nextAttempt = calculateBackoff(job.attempts);
    }
    await job.save();
  }

  return true; 
};

// Maintenance: Recover stuck jobs
const recoverStuckJobs = async () => {
  const cutoff = new Date(Date.now() - LEASE_TIMEOUT);
  const result = await EmailQueue.updateMany(
    {
      status: "processing",
      processingAt: { $lt: cutoff },
    },
    {
      $set: {
        status: "pending",
        processingAt: undefined,
        processingBy: undefined,
        lastError: "Lease expired (stuck job)",
      },
    }
  );
  // if (result.modifiedCount > 0) {
  //   console.warn(`[${WORKER_ID}] Recovered ${result.modifiedCount} stuck jobs.`);
  // }
};

// Main Worker Loop
export const startEmailWorker = async () => {
 

  // Recovery Loop
  setInterval(recoverStuckJobs, 60 * 1000); // Every minute

  // Processing Loop
  while (true) {
    try {
      // Run N jobs in parallel
      const promises = [];
      for (let i = 0; i < CONCURRENCY; i++) {
        promises.push(processJob());
      }

      const results = await Promise.all(promises);
      const processedAny = results.some((r) => r === true);

      if (!processedAny) {
        // If no jobs were found, wait a bit to avoid hammering DB
        await sleep(POLL_INTERVAL);
      }
      // Else loop immediately to drain queue
    } catch (error) {
      console.error(`[${WORKER_ID}] Worker Loop Error:`, error);
      await sleep(5000);
    }
  }
};
