import { createChildLogger } from "@/lib/logger";
import { env } from "@/config/env";
import { getRedisClient } from "@/lib/redis";

const log = createChildLogger("worker-main");

async function startWorker() {
  log.info({ env: env.NODE_ENV }, "Starting Revenue Guardian background worker...");
  getRedisClient();
  log.info("Background worker initialized and listening for jobs.");
}

startWorker().catch((err) => {
  log.error({ err }, "Fatal error in background worker");
  process.exit(1);
});
