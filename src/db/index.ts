import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/config/env";
import * as schema from "./schema";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("db");

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export function getPgPool(): Pool {
  if (!global.__pgPool) {
    const isSsl = env.DATABASE_URL.includes("sslmode=require") || env.DATABASE_URL.includes("neon.tech");
    global.__pgPool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    global.__pgPool.on("error", (err) => {
      log.error({ err }, "Unexpected Postgres pool error");
    });
  }

  return global.__pgPool;
}

export const pool = getPgPool();
export const db = drizzle(pool, { schema });
export { schema };

