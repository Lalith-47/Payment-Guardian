import { describe, it, expect } from "vitest";
import { enforceTestDatabaseUrl, getRedactedUrl, resolveAndGuardTestDatabaseUrl } from "@/lib/db-guard";

describe("Database Guard Isolation", () => {
  it("redacts password from connection URL", () => {
    const raw = "postgresql://postgres:secretpassword123@localhost:5433/revenue_guardian_test";
    const redacted = getRedactedUrl(raw);
    expect(redacted).not.toContain("secretpassword123");
    expect(redacted).toBe("postgresql://postgres:*****@localhost:5433/revenue_guardian_test");
  });

  it("accepts valid URL with _test database suffix", () => {
    const valid = "postgresql://postgres:pass@localhost:5433/revenue_guardian_test";
    const result = enforceTestDatabaseUrl(valid);
    expect(result).toBe(valid);
  });

  it("strictly refuses to start on production/demo database without _test suffix", () => {
    const prodUrl = "postgresql://postgres:secret@localhost:5433/revenue_guardian";
    expect(() => enforceTestDatabaseUrl(prodUrl)).toThrowError(
      /Database 'revenue_guardian' does not end in '_test'/
    );
  });

  it("strictly refuses on non-test database with query parameters", () => {
    const prodWithParams = "postgresql://postgres:secret@localhost:5433/revenue_guardian?sslmode=disable";
    expect(() => enforceTestDatabaseUrl(prodWithParams)).toThrowError(
      /Database 'revenue_guardian' does not end in '_test'/
    );
  });

  it("throws on empty or invalid URL format", () => {
    expect(() => enforceTestDatabaseUrl("")).toThrowError(/DATABASE_GUARD_ERROR/);
    expect(() => enforceTestDatabaseUrl("not-a-valid-url")).toThrowError(/Invalid database URL/);
  });

  it("resolveAndGuardTestDatabaseUrl appends _test cleanly without regex artifacts", () => {
    const prevUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://postgres:pass@localhost:5433/my_custom_db";
    const resolved = resolveAndGuardTestDatabaseUrl();
    expect(resolved).toBe("postgresql://postgres:pass@localhost:5433/my_custom_db_test");
    expect(resolved).not.toContain("$1");
    process.env.DATABASE_URL = prevUrl;
  });
});
