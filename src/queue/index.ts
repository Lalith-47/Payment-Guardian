import { Queue, Worker, Job } from "bullmq";
import { getRedisClient } from "@/lib/redis";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("queue");

export const EVENTS_QUEUE_NAME = "rg-events-queue";
export const RECONCILIATION_QUEUE_NAME = "rg-reconciliation-queue";
export const DEAD_LETTER_QUEUE_NAME = "rg-dead-letter-queue";

let _eventsQueue: Queue | undefined;
export const eventsQueue = new Proxy({} as Queue, {
  get(target, prop, receiver) {
    if (!_eventsQueue) {
      _eventsQueue = new Queue(EVENTS_QUEUE_NAME, {
        connection: getRedisClient(),
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
    }
    const val = Reflect.get(_eventsQueue, prop, receiver);
    return typeof val === "function" ? val.bind(_eventsQueue) : val;
  },
});

let _reconciliationQueue: Queue | undefined;
export const reconciliationQueue = new Proxy({} as Queue, {
  get(target, prop, receiver) {
    if (!_reconciliationQueue) {
      _reconciliationQueue = new Queue(RECONCILIATION_QUEUE_NAME, {
        connection: getRedisClient(),
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
    }
    const val = Reflect.get(_reconciliationQueue, prop, receiver);
    return typeof val === "function" ? val.bind(_reconciliationQueue) : val;
  },
});

let _deadLetterQueue: Queue | undefined;
export const deadLetterQueue = new Proxy({} as Queue, {
  get(target, prop, receiver) {
    if (!_deadLetterQueue) {
      _deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, {
        connection: getRedisClient(),
      });
    }
    const val = Reflect.get(_deadLetterQueue, prop, receiver);
    return typeof val === "function" ? val.bind(_deadLetterQueue) : val;
  },
});

export interface EventJobPayload {
  eventId: string;
  type: string;
  source: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface ReconcileJobPayload {
  entityType: "order" | "invoice";
  entityId: string;
  attempt?: number;
}
