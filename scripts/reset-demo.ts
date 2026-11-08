import { pool } from "@/db";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("reset-demo");

export async function resetDemoDatabase(options: { dryRun?: boolean } = {}) {
  const isDryRun = options.dryRun ?? process.argv.includes("--dry-run");

  if (!isDryRun && process.env.ALLOW_DEMO_RESET !== "true") {
    console.error(
      "FATAL: Refusing to reset demo database. ALLOW_DEMO_RESET=true environment variable must be explicitly set."
    );
    process.exit(1);
  }

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

  const preservedTables = [
    "user",
    "account",
    "session",
    "verification",
    "policies",
    "policy_versions",
    "llm_requests",
  ];

  if (isDryRun) {
    console.log("============================================================");
    console.log("DEMO DATABASE RESET: --dry-run (NO MODIFICATIONS MADE)");
    console.log("============================================================\n");

    console.log("TABLES SCHEDULED FOR TRUNCATE (App State):");
    console.log("------------------------------------------------------------");
    for (const table of appTables) {
      try {
        const res = await pool.query(`SELECT count(*)::int as count FROM "${table}";`);
        const count = res.rows[0]?.count ?? 0;
        console.log(`  - ${table.padEnd(22)} : ${count} rows (WOULD BE DELETED)`);
      } catch (err) {
        console.log(`  - ${table.padEnd(22)} : [Table does not exist or inaccessible]`);
      }
    }

    console.log("\nTABLES PRESERVED (Configuration, Auth & Accounting):");
    console.log("------------------------------------------------------------");
    for (const table of preservedTables) {
      try {
        const res = await pool.query(`SELECT count(*)::int as count FROM "${table}";`);
        const count = res.rows[0]?.count ?? 0;
        console.log(`  - ${table.padEnd(22)} : ${count} rows (PRESERVED)`);
      } catch (err) {
        console.log(`  - ${table.padEnd(22)} : [Table does not exist or inaccessible]`);
      }
    }

    console.log("\n============================================================");
    console.log("Dry run complete. No records were deleted.");
    console.log("To execute actual reset: ALLOW_DEMO_RESET=true pnpm tsx scripts/reset-demo.ts");
    console.log("============================================================");
    return;
  }

  console.log("ALLOW_DEMO_RESET=true confirmed. Proceeding with selective app table wipe (leaving users and policies intact)...");

  try {
    const truncateQuery = `TRUNCATE TABLE ${appTables.join(", ")} CASCADE;`;
    await pool.query(truncateQuery);
    console.log(`Successfully truncated app tables: ${appTables.join(", ")}`);
    console.log("Preserved tables: user, account, session, verification, policies, policy_versions, llm_requests");
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
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Error during reset execution:", err);
      await pool.end();
      process.exit(1);
    });
}


