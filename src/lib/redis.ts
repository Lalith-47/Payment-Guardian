import { Redis } from "ioredis";
import { env } from "@/config/env";
import { createChildLogger } from "./logger";

const log = createChildLogger("redis");

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Redis | undefined;
}

export function resolveRedisUrl(): string {
  if (process.env.TEST_REDIS_URL) {
    return process.env.TEST_REDIS_URL;
  }
  if (process.env.NODE_ENV === "test") {
    try {
      const u = new URL(env.REDIS_URL);
      u.pathname = "/2"; // Redis DB 2 strictly reserved for tests to avoid demo DB pollution
      return u.toString();
    } catch {
      return env.REDIS_URL;
    }
  }
  return env.REDIS_URL;
}

export function getRedisClient(): Redis {
  if (!global.__redisClient) {
    const url = resolveRedisUrl();
    global.__redisClient = new Redis(url, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      lazyConnect: process.env.SKIP_ENV_VALIDATION === "1",
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

