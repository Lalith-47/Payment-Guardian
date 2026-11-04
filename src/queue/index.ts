import { Queue, Worker, Job } from "bullmq";
import { getRedisClient } from "@/lib/redis";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("queue");

const connection = getRedisClient();

export const EVENTS_QUEUE_NAME = "rg-events-queue";
export const RECONCILIATION_QUEUE_NAME = "rg-reconciliation-queue";
export const DEAD_LETTER_QUEUE_NAME = "rg-dead-letter-queue";

// Queues
export const eventsQueue = new Queue(EVENTS_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export const reconciliationQueue = new Queue(RECONCILIATION_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, {
  connection,
});

export interface EventJobPayload {
  eventId: string;
  type: string;
  source: string;
  timestamp: string;
}

export interface ReconcileJobPayload {
  entityType: "order" | "invoice";
  entityId: string;
  attempt?: number;
}

