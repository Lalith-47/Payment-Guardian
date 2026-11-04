import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";
import { createChildLogger } from "@/lib/logger";
import path from "path";

const log = createChildLogger("migration");

export async function runMigrations() {
  log.info("Running database migrations...");
  try {
    const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
    await migrate(db, { migrationsFolder });
    log.info("Database migrations applied successfully.");
  } catch (err) {
    log.error({ err }, "Database migration failed");
    throw err;
  }
}

// If executed directly via CLI
if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations()
    .then(() => {
      console.log("Migration script completed.");
      return pool.end();
    })
    .catch((err) => {
      console.error("Migration script failed:", err);
      process.exit(1);
    });
}

