import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Architecture Audit: Mutating PayPal Client Methods (Gate G0 Item 9)", () => {
  const mutatingMethods = [
    "createOrder",
    "captureOrder",
    "createDraftInvoice",
    "sendInvoice",
    "refundCapturedPayment",
    "refundPayment",
  ];

  // Modules permitted to call mutating PayPal methods:
  // 1. src/paypal/client.ts - definition of PayPal client
  // 2. src/executor/index.ts - ONLY module permitted to execute AI-driven actions
  // 3. src/app/api/paypal/capture/route.ts - merchant-side checkout capture route
  // 4. src/app/api/paypal/create-order/route.ts - merchant-side checkout order route (if added)
  const allowedFiles = new Set([
    path.normalize("src/paypal/client.ts"),
    path.normalize("src/executor/index.ts"),
    path.normalize("src/app/api/paypal/capture/route.ts"),
    path.normalize("src/app/api/paypal/create-order/route.ts"),
  ]);

  function getAllSourceFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllSourceFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it("fails if any module outside executor or merchant checkout routes calls mutating PayPal methods", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const allSrcFiles = getAllSourceFiles(srcDir);
    const violations: { file: string; method: string; line: number }[] = [];

    for (const file of allSrcFiles) {
      const relPath = path.normalize(path.relative(process.cwd(), file));
      if (allowedFiles.has(relPath)) {
        continue;
      }

      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        // Skip comment lines
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

        for (const method of mutatingMethods) {
          // Check for method call or import
          const regex = new RegExp(`\\b${method}\\b`);
          if (regex.test(line)) {
            violations.push({
              file: relPath,
              method,
              line: idx + 1,
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `Violation in ${v.file}:${v.line} -> calls/references '${v.method}'`)
        .join("\n");
      expect.fail(
        `Architecture violation! Mutating PayPal client methods must ONLY be called from ActionExecutor or merchant-side checkout routes.\n${details}`
      );
    }

    expect(violations.length).toBe(0);
  });
});

