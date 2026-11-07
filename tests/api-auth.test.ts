import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { isAllowlistedPath } from "@/middleware";

describe("S1 Architecture Audit: API Route Authentication Enforcement", () => {
  const allowlistedRoutes = new Set([
    path.normalize("src/app/api/auth/[...all]/route.ts"),
    path.normalize("src/app/api/webhooks/paypal/route.ts"),
  ]);

  function findApiRoutes(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findApiRoutes(fullPath));
      } else if (entry.isFile() && (entry.name === "route.ts" || entry.name === "route.js")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it("fails if any API route outside the allowlist lacks owner session enforcement", () => {
    const apiDir = path.resolve(process.cwd(), "src/app/api");
    const allRoutes = findApiRoutes(apiDir);
    expect(allRoutes.length).toBeGreaterThan(0);

    const unprotectedRoutes: { file: string; reason: string }[] = [];
    const protectedRoutesReport: { route: string; protection: string }[] = [];

    for (const file of allRoutes) {
      const relPath = path.normalize(path.relative(process.cwd(), file));

      if (allowlistedRoutes.has(relPath)) {
        if (relPath.includes("webhooks")) {
          protectedRoutesReport.push({ route: relPath, protection: "PayPal Webhook Signature (verifyPayPalWebhookSignature)" });
        } else if (relPath.includes("auth")) {
          protectedRoutesReport.push({ route: relPath, protection: "Better-Auth Engine Handler" });
        }
        continue;
      }

      const content = fs.readFileSync(file, "utf8");
      const hasRequireOwnerSession = content.includes("requireOwnerSession") || content.includes("withOwnerAuth");

      if (!hasRequireOwnerSession) {
        unprotectedRoutes.push({
          file: relPath,
          reason: "Missing requireOwnerSession or withOwnerAuth check in route file",
        });
      } else {
        protectedRoutesReport.push({
          route: relPath,
          protection: "Owner Session Required (requireOwnerSession / better-auth)",
        });
      }
    }

    if (unprotectedRoutes.length > 0) {
      const errorMsg = unprotectedRoutes
        .map((u) => `VIOLATION: ${u.file} -> ${u.reason}`)
        .join("\n");
      expect.fail(`Unprotected API route(s) found without Owner Session enforcement:\n${errorMsg}`);
    }

    expect(unprotectedRoutes.length).toBe(0);
  });

  it("middleware allowlist correctly excludes public probes and webhook while protecting other /api paths", () => {
    expect(isAllowlistedPath("/healthz")).toBe(true);
    expect(isAllowlistedPath("/readyz")).toBe(true);
    expect(isAllowlistedPath("/api/auth/signin")).toBe(true);
    expect(isAllowlistedPath("/api/webhooks/paypal")).toBe(true);

    // Business routes MUST NOT be allowlisted
    expect(isAllowlistedPath("/api/paypal/capture")).toBe(false);
    expect(isAllowlistedPath("/api/onboarding/policies")).toBe(false);
    expect(isAllowlistedPath("/api/events")).toBe(false);
    expect(isAllowlistedPath("/api/approvals")).toBe(false);
  });

  it("forged better-auth.session_token=forged cookie gets 401 on every protected route (DB session validation)", async () => {
    const apiDir = path.resolve(process.cwd(), "src/app/api");
    const allRoutes = findApiRoutes(apiDir);

    for (const file of allRoutes) {
      const relPath = path.normalize(path.relative(process.cwd(), file));
      if (allowlistedRoutes.has(relPath)) {
        continue;
      }

      // Dynamically import the route handler
      const mod = await import(path.resolve(file));
      const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

      for (const method of methods) {
        if (typeof mod[method] === "function") {
          const forgedReq = new Request(`http://localhost:3000/${relPath.replace("src/app/", "").replace("/route.ts", "")}`, {
            method,
            headers: {
              "Content-Type": "application/json",
              cookie: "better-auth.session_token=forged",
            },
            body: method !== "GET" ? JSON.stringify({ test: "forged" }) : undefined,
          });

          // Some route handlers take a second context argument (e.g. params: Promise<{ id: string }>)
          const res = await mod[method](forgedReq, {
            params: Promise.resolve({ id: "test_id", token: "test_token" }),
          });

          expect(res.status, `Route ${relPath} [${method}] must return 401 for forged session cookie`).toBe(401);
          const body = await res.json();
          expect(body.error).toMatch(/Unauthorized/i);
        }
      }
    }
  });
});

