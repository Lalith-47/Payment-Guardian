export function getRedactedUrl(url: URL | string): string {
  try {
    const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());
    if (parsed.password) {
      parsed.password = "*****";
    }
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

export function enforceTestDatabaseUrl(rawUrl?: string): string {
  const urlString = rawUrl !== undefined ? rawUrl : (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  if (!urlString || urlString.trim() === "") {
    throw new Error("DATABASE_GUARD_ERROR: No DATABASE_URL or TEST_DATABASE_URL provided.");
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch (err) {
    throw new Error(`DATABASE_GUARD_ERROR: Invalid database URL format: ${(err as Error).message}`);
  }

  const dbName = parsed.pathname.replace(/^\/+/, "");
  if (!dbName || !dbName.endsWith("_test")) {
    const redacted = getRedactedUrl(parsed);
    throw new Error(
      `DATABASE_GUARD_ERROR: Database '${dbName}' does not end in '_test'. Refusing to start test against non-test database: ${redacted}`
    );
  }

  return parsed.toString();
}

export function resolveAndGuardTestDatabaseUrl(): string {
  const rawUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  let targetUrl = rawUrl;

  if (targetUrl) {
    const parsed = new URL(targetUrl);
    const dbName = parsed.pathname.replace(/^\/+/, "");
    if (!dbName.endsWith("_test")) {
      parsed.pathname = `/${dbName}_test`;
    }
    targetUrl = parsed.toString();
  } else {
    targetUrl = "postgresql://postgres:postgres@localhost:5433/revenue_guardian_test";
  }

  const guarded = enforceTestDatabaseUrl(targetUrl);
  console.log(`[DB GUARD] Resolved Test Database: ${getRedactedUrl(guarded)}`);
  return guarded;
}
