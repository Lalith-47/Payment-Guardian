import { resolveAndGuardTestDatabaseUrl, enforceTestDatabaseUrl } from "../../src/lib/db-guard";

async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";
  console.log(`[PLAYWRIGHT-GUARD] Target baseURL: ${baseURL}`);

  // 1. Database name guard: strictly refuse if resolved DB name does not end in _test
  const testDbUrl = resolveAndGuardTestDatabaseUrl();
  enforceTestDatabaseUrl(testDbUrl);

  // 2. Fetch /healthz and strictly REFUSE to run unless STACK_ROLE is 'e2e'
  const healthUrl = `${baseURL.replace(/\/+$/, "")}/healthz`;
  let res: Response;
  try {
    res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    throw new Error(
      `[PLAYWRIGHT-GUARD] Failed to reach /healthz at ${healthUrl}: ${(err as Error).message}. Target stack must be running and healthy before tests execute.`
    );
  }

  if (!res.ok) {
    throw new Error(
      `[PLAYWRIGHT-GUARD] Target /healthz returned status ${res.status}. Expected 200 OK from isolated e2e stack.`
    );
  }

  const data = (await res.json()) as { status?: string; stackRole?: string };
  if (data.stackRole !== "e2e") {
    throw new Error(
      `[PLAYWRIGHT-GUARD] REFUSING TO RUN: Target stack role is '${data.stackRole || "unknown"}' (expected 'e2e'). Playwright is strictly prohibited from targeting the demo stack (${baseURL}).`
    );
  }

  console.log(`[PLAYWRIGHT-GUARD] Verified target stack role is 'e2e' and test database is isolated.`);
}

export default globalSetup;

