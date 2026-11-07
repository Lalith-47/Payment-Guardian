import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

describe("Architecture: No Hardcoded Tunnel URLs", () => {
  it("fails if any file under src/ or scripts/ contains the literal string 'trycloudflare.com'", () => {
    const rootDir = process.cwd();
    const srcFiles = getAllFiles(path.join(rootDir, "src"));
    const scriptsFiles = getAllFiles(path.join(rootDir, "scripts"));
    const allFiles = [...srcFiles, ...scriptsFiles];

    const violations: { file: string; line: number; content: string }[] = [];

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (content.includes("trycloudflare.com")) {
        const lines = content.split("\n");
        lines.forEach((line, index) => {
          if (line.includes("trycloudflare.com")) {
            violations.push({
              file: path.relative(rootDir, filePath),
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      }
    }

    expect(
      violations,
      `Found forbidden literal 'trycloudflare.com' in the following files:\n${JSON.stringify(
        violations,
        null,
        2
      )}`
    ).toEqual([]);
  });
});
