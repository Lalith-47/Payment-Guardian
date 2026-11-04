import { Worker, Job } from "bullmq";
import { getRedisClient } from "@/lib/redis";
import { EVENTS_QUEUE_NAME, RECONCILIATION_QUEUE_NAME, reconciliationQueue } from "@/queue";
import { processEventPipeline } from "@/pipeline/processor";
import { reconcileNonTerminalRecords } from "@/reconciler";
import { createChildLogger } from "@/lib/logger";
import { env } from "@/config/env";

const log = createChildLogger("worker");
const connection = getRedisClient();

export function startEventWorker() {
  const worker = new Worker(
    EVENTS_QUEUE_NAME,
    async (job: Job) => {
      log.info({ jobId: job.id, name: job.name, data: job.data }, "Worker processing event job");
      await processEventPipeline(job.data);
    },
    { connection, concurrency: 5 }
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job?.id }, "Event job completed successfully");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Event job failed");
  });

  return worker;
}

export function startReconciliationWorker() {
  const worker = new Worker(
    RECONCILIATION_QUEUE_NAME,
    async (job: Job) => {
      log.info({ jobId: job.id }, "Running scheduled reconciliation sweep");
      await reconcileNonTerminalRecords();
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Reconciliation job failed");
  });

  return worker;
}

async function main() {
  log.info({ env: env.NODE_ENV }, "Starting Revenue Guardian BullMQ background worker daemon...");

  startEventWorker();
  startReconciliationWorker();

  // Schedule repeatable reconciliation sweep every 60 seconds
  await reconciliationQueue.upsertJobScheduler(
    "repeatable_reconciliation_sweep",
    {
      every: 60000, // every 60 seconds
    }
  );

  log.info("Worker daemon online and ready for jobs.");
}

if (process.argv[1]?.endsWith("worker.ts") || process.argv[1]?.endsWith("worker.js")) {
  main().catch((err) => {
    log.error({ err }, "Fatal error starting worker daemon");
    process.exit(1);
  });
}
