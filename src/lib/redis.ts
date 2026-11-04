import { Redis } from "ioredis";
import { env } from "@/config/env";
import { createChildLogger } from "./logger";

const log = createChildLogger("redis");

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Redis | undefined;
}

export function getRedisClient(): Redis {
  if (!global.__redisClient) {
    global.__redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        log.warn({ attempt: times, delay }, "Reconnecting to Redis...");
        return delay;
      },
    });

    global.__redisClient.on("error", (err) => {
      log.error({ err }, "Redis connection error");
    });

    global.__redisClient.on("connect", () => {
      log.info("Redis connected");
    });
  }

  return global.__redisClient;
}

export const redis = getRedisClient();
