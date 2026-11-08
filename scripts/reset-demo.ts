import { pool } from "@/db";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("reset-demo");

export async function resetDemoDatabase(options: { dryRun?: boolean; keepActivePolicyOnly?: boolean } = {}) {
  const isDryRun = options.dryRun ?? process.argv.includes("--dry-run");
  const keepActivePolicyOnly =
    options.keepActivePolicyOnly ??
    (process.argv.includes("--keep-active-policy-only") || process.argv.includes("--prune-policies"));

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
    "llm_requests",
  ];

  // Helper to get row count of a table
  async function getCount(table: string): Promise<number> {
    try {
      const res = await pool.query(`SELECT count(*)::int as count FROM "${table}";`);
      return res.rows[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  // Find active policy and its latest version
  let activePolicyId: string | null = null;
  let latestVersionId: number | null = null;
  let totalPolicies = 0;
  let totalVersions = 0;

  try {
    const polRes = await pool.query(`SELECT count(*)::int as count FROM policies;`);
    totalPolicies = polRes.rows[0]?.count ?? 0;
    const verRes = await pool.query(`SELECT count(*)::int as count FROM policy_versions;`);
    totalVersions = verRes.rows[0]?.count ?? 0;

    const activeRes = await pool.query(
      `SELECT id FROM policies WHERE is_active = true ORDER BY created_at DESC LIMIT 1;`
    );
    activePolicyId = activeRes.rows[0]?.id ?? null;

    if (activePolicyId) {
      const verLatest = await pool.query(
        `SELECT id FROM policy_versions WHERE policy_id = $1 ORDER BY version DESC LIMIT 1;`,
        [activePolicyId]
      );
      latestVersionId = verLatest.rows[0]?.id ?? null;
    }
  } catch (err) {
    log.warn({ err }, "Error inspecting policies table");
  }

  if (isDryRun) {
    console.log("============================================================");
    console.log("DEMO DATABASE RESET: --dry-run (NO MODIFICATIONS MADE)");
    if (keepActivePolicyOnly) {
      console.log("Option: --keep-active-policy-only (ACTIVE POLICY PRUNING ENABLED)");
    }
    console.log("============================================================\n");

    console.log("TABLES SCHEDULED FOR TRUNCATE (App State):");
    console.log("------------------------------------------------------------");
    for (const table of appTables) {
      const count = await getCount(table);
      console.log(`  - ${table.padEnd(22)} : ${count} rows (WOULD BE DELETED)`);
    }

    if (keepActivePolicyOnly) {
      console.log("\nPOLICY TABLES (Selective Pruning to Single Active Version):");
      console.log("------------------------------------------------------------");
      console.log(
        `  - ${"policies".padEnd(22)} : ${totalPolicies} total -> 1 PRESERVED (active: ${activePolicyId}), ${Math.max(0, totalPolicies - 1)} WOULD BE DELETED`
      );
      console.log(
        `  - ${"policy_versions".padEnd(22)} : ${totalVersions} total -> 1 PRESERVED (version id: ${latestVersionId}), ${Math.max(0, totalVersions - 1)} WOULD BE DELETED`
      );
    } else {
      console.log("\nPOLICY TABLES (All Preserved):");
      console.log("------------------------------------------------------------");
      console.log(`  - ${"policies".padEnd(22)} : ${totalPolicies} rows (PRESERVED)`);
      console.log(`  - ${"policy_versions".padEnd(22)} : ${totalVersions} rows (PRESERVED)`);
    }

    console.log("\nTABLES PRESERVED (Auth & Accounting):");
    console.log("------------------------------------------------------------");
    for (const table of preservedTables) {
      const count = await getCount(table);
      console.log(`  - ${table.padEnd(22)} : ${count} rows (PRESERVED)`);
    }

    console.log("\n============================================================");
    console.log("Dry run complete. No records were deleted.");
    console.log(
      `To execute actual reset: ALLOW_DEMO_RESET=true pnpm tsx scripts/reset-demo.ts${
        keepActivePolicyOnly ? " --keep-active-policy-only" : ""
      }`
    );
    console.log("============================================================");
    return;
  }

  console.log("ALLOW_DEMO_RESET=true confirmed. Proceeding with database reset...");

  const allAuditedTables = [
    ...appTables,
    "policies",
    "policy_versions",
    ...preservedTables,
  ];

  const beforeCounts: Record<string, number> = {};
  for (const table of allAuditedTables) {
    beforeCounts[table] = await getCount(table);
  }

  try {
    // 1. Truncate app tables
    const truncateQuery = `TRUNCATE TABLE ${appTables.join(", ")} CASCADE;`;
    await pool.query(truncateQuery);

    // 2. If keepActivePolicyOnly is enabled, prune inactive policies and older versions
    if (keepActivePolicyOnly && activePolicyId) {
      if (latestVersionId !== null) {
        await pool.query(
          `DELETE FROM policy_versions WHERE policy_id = $1 AND id != $2;`,
          [activePolicyId, latestVersionId]
        );
      }
      await pool.query(
        `DELETE FROM policies WHERE id != $1;`,
        [activePolicyId]
      );
    }

    // Collect after counts
    const afterCounts: Record<string, number> = {};
    for (const table of allAuditedTables) {
      afterCounts[table] = await getCount(table);
    }

    console.log("\nRESET SUMMARY (Per-Table Row Counts Before and After):");
    console.log("----------------------------------------------------------------------");
    console.log(`| ${"Table Name".padEnd(22)} | ${"Before".padStart(10)} | ${"After".padStart(10)} | ${"Delta / Status".padEnd(20)} |`);
    console.log("----------------------------------------------------------------------");
    for (const table of allAuditedTables) {
      const before = beforeCounts[table] ?? 0;
      const after = afterCounts[table] ?? 0;
      const delta = after - before;
      const status = delta === 0 ? "Preserved (0 delta)" : `Deleted ${Math.abs(delta)} rows`;
      console.log(`| ${table.padEnd(22)} | ${String(before).padStart(10)} | ${String(after).padStart(10)} | ${status.padEnd(20)} |`);
    }
    console.log("----------------------------------------------------------------------\n");
    console.log("Database reset completed successfully.");
  } catch (err) {
    log.error({ err }, "Failed to execute demo reset");
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
