import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function getAllFiles(dir: string, extList: string[]): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, extList));
    } else if (extList.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Sloplint Zero-Default-Palette Regression Guard", () => {
  it("strictly asserts zero default Tailwind palette classes across src/", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const files = getAllFiles(srcDir, [".ts", ".tsx", ".css"]);
    const forbiddenPattern =
      /\b(bg|text|border|ring|from|to|via)-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|pink|rose)-[0-9]{2,3}\b/g;

    const violations: Array<{ file: string; line: number; match: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((lineText, idx) => {
        const matches = lineText.match(forbiddenPattern);
        if (matches) {
          for (const m of matches) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: idx + 1,
              match: m,
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const details = violations.map((v) => `${v.file}:${v.line} -> ${v.match}`).join("\n");
      expect.fail(`Found ${violations.length} default Tailwind palette classes in src/:\n${details}`);
    }

    expect(violations.length).toBe(0);
  });
});

