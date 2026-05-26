import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "src");
const VALID_EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORE_SEGMENTS = new Set(["__tests__", "__mocks__"]);

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function listSourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_SEGMENTS.has(entry.name)) {
        continue;
      }
      files.push(...listSourceFiles(absolutePath));
      continue;
    }
    const extension = path.extname(entry.name);
    if (!VALID_EXTENSIONS.has(extension)) {
      continue;
    }
    if (entry.name.includes(".test.")) {
      continue;
    }
    files.push(absolutePath);
  }
  return files;
}

function getLayer(projectPath) {
  if (projectPath.startsWith("src/domain/")) {
    return "domain";
  }
  if (projectPath.startsWith("src/features/")) {
    if (projectPath.endsWith("/screens.tsx")) {
      return "ui";
    }
    return projectPath.includes("/screens/") ? "ui" : "application";
  }
  return null;
}

function extractImportSpecifiers(sourceCode) {
  const results = [];
  const importRegex =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`]+\s+from\s+)?["'`]([^"'`]+)["'`]/g;
  let match = importRegex.exec(sourceCode);
  while (match) {
    results.push(match[1]);
    match = importRegex.exec(sourceCode);
  }
  return results;
}

function resolveImportPath(filePath, importSpecifier) {
  if (!importSpecifier.startsWith(".")) {
    return null;
  }
  const directory = path.dirname(filePath);
  const rawTarget = path.resolve(directory, importSpecifier);
  const candidates = [
    rawTarget,
    `${rawTarget}.ts`,
    `${rawTarget}.tsx`,
    path.join(rawTarget, "index.ts"),
    path.join(rawTarget, "index.tsx"),
  ];

  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolved) {
    return null;
  }
  return toPosix(path.relative(ROOT, resolved));
}

const violations = [];
const files = listSourceFiles(SOURCE_ROOT);

for (const file of files) {
  const relativeFilePath = toPosix(path.relative(ROOT, file));
  const layer = getLayer(relativeFilePath);
  if (!layer) {
    continue;
  }
  const sourceCode = fs.readFileSync(file, "utf8");
  const imports = extractImportSpecifiers(sourceCode);
  for (const importSpecifier of imports) {
    const resolved = resolveImportPath(file, importSpecifier);
    if (!resolved) {
      continue;
    }
    if (layer === "domain") {
      const isDomainImport = resolved.startsWith("src/domain/");
      const isI18nImport =
        resolved.startsWith("src/i18n/") ||
        importSpecifier === "../i18n" ||
        importSpecifier.startsWith("../i18n/");
      if (!isDomainImport && !isI18nImport) {
        violations.push({
          file: relativeFilePath,
          importSpecifier,
          message:
            "Domain layer must stay pure and can only import modules from src/domain or translation contracts in src/i18n.",
        });
      }
      continue;
    }
    if (layer === "application" && resolved.includes("/screens/")) {
      violations.push({
        file: relativeFilePath,
        importSpecifier,
        message:
          "Application/store layer must not import from screens/ui modules.",
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary check failed:");
  for (const violation of violations) {
    console.error(
      `- ${violation.file} imports "${violation.importSpecifier}": ${violation.message}`,
    );
  }
  process.exit(1);
}

console.log("Architecture boundary check passed.");
