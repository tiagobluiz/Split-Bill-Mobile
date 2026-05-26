import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIRECTORIES = [path.join(ROOT, "app"), path.join(ROOT, "src")];
const VALID_EXTENSIONS = new Set([".ts", ".tsx"]);

const policyPath = path.join(ROOT, "scripts", "max-lines-exceptions.json");
const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const maxLines = Number(policy.maxLines ?? 1000);
const exceptions = policy.exceptions ?? {};

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function shouldSkip(fileName) {
  return (
    fileName.includes(".test.") ||
    fileName.endsWith(".generated.ts") ||
    fileName.endsWith(".generated.tsx")
  );
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test" || entry.name === "__tests__") {
        continue;
      }
      files.push(...listFiles(absolutePath));
      continue;
    }
    const extension = path.extname(entry.name);
    if (!VALID_EXTENSIONS.has(extension)) {
      continue;
    }
    if (shouldSkip(entry.name)) {
      continue;
    }
    files.push(absolutePath);
  }
  return files;
}

const violations = [];
const missingExceptionMetadata = [];

for (const sourceDirectory of SOURCE_DIRECTORIES) {
  for (const filePath of listFiles(sourceDirectory)) {
    const relativeFilePath = toPosix(path.relative(ROOT, filePath));
    const lineCount = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
    if (lineCount <= maxLines) {
      continue;
    }
    const exception = exceptions[relativeFilePath];
    if (!exception) {
      violations.push({ file: relativeFilePath, lineCount });
      continue;
    }
    if (!exception.rationale || !exception.followUpIssue) {
      missingExceptionMetadata.push(relativeFilePath);
    }
  }
}

if (missingExceptionMetadata.length > 0) {
  console.error("Max-lines policy misconfigured. Missing rationale/followUpIssue:");
  for (const file of missingExceptionMetadata) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

if (violations.length > 0) {
  console.error(`Max-lines check failed (>${maxLines} lines):`);
  for (const violation of violations) {
    console.error(`- ${violation.file} (${violation.lineCount} lines)`);
  }
  console.error(
    "Add a documented exception in scripts/max-lines-exceptions.json with rationale and followUpIssue or refactor the file.",
  );
  process.exit(1);
}

console.log(`Max-lines check passed (threshold: ${maxLines}).`);

