import { pool } from "@/db";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("reset-demo");

export async function resetDemoDatabase() {
  if (process.env.ALLOW_DEMO_RESET !== "true") {
    console.error("FATAL: Refusing to reset demo database. ALLOW_DEMO_RESET=true environment variable must be explicitly set.");
    process.exit(1);
  }

  console.log("ALLOW_DEMO_RESET=true confirmed. Proceeding with selective app table wipe (leaving users and policies intact)...");

  const appTables = [
    "actions",
    "approvals",
    "audit_log",
    "proposals",
    "events",
    "webhook_deliveries",
    "paypal_orders",
    "paypal_invoices",
  ];

  try {
    const truncateQuery = `TRUNCATE TABLE ${appTables.join(", ")} CASCADE;`;
    await pool.query(truncateQuery);
    console.log(`Successfully truncated app tables: ${appTables.join(", ")}`);
    console.log("Preserved tables: user, account, session, verification, policies, policy_versions");
  } catch (err) {
    log.error({ err }, "Failed to truncate demo app tables");
    console.error("Failed to reset demo tables:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("reset-demo.ts") || process.argv[1]?.endsWith("reset-demo.js")) {
  resetDemoDatabase()
    .then(() => {
      console.log("Demo database reset completed cleanly.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error during reset execution:", err);
      process.exit(1);
    });
}
