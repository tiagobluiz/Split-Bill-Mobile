import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const VERSION_FILES = new Set([
  "app.json",
  "package.json",
  "package-lock.json",
  "android/app/build.gradle",
]);

function runGit(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function canResolve(ref) {
  try {
    runGit(["rev-parse", "--verify", "--quiet", ref]);
    return true;
  } catch {
    return false;
  }
}

function getPushBeforeSha() {
  if (process.env.GITHUB_EVENT_BEFORE && canResolve(process.env.GITHUB_EVENT_BEFORE)) {
    return process.env.GITHUB_EVENT_BEFORE;
  }

  if (!process.env.GITHUB_EVENT_PATH || !fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
    return null;
  }

  try {
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    return event.before && canResolve(event.before) ? event.before : null;
  } catch {
    return null;
  }
}

function getComparisonBase() {
  if (process.env.VERSION_POLICY_BASE) {
    return process.env.VERSION_POLICY_BASE;
  }

  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  const pushBeforeSha = getPushBeforeSha();
  if (pushBeforeSha) {
    return pushBeforeSha;
  }

  if (canResolve("origin/main")) {
    return "origin/main";
  }

  if (canResolve("HEAD~1")) {
    return "HEAD~1";
  }

  return null;
}

function getChangedFiles(base) {
  if (!base) {
    return [];
  }

  const committedChanges = runGit(["diff", "--name-only", `${base}...HEAD`]);
  const workingTreeChanges = runGit(["diff", "--name-only", base]);
  return [...new Set([...committedChanges.split(/\r?\n/), ...workingTreeChanges.split(/\r?\n/)].filter(Boolean))]
    .map((file) => file.split(path.sep).join("/"));
}

function isTestFile(file) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.includes("/__tests__/");
}

function isDeploymentImpacting(file) {
  if (VERSION_FILES.has(file)) {
    return false;
  }

  if (file.startsWith("docs/") || file.startsWith(".github/") || file.startsWith("scripts/")) {
    return false;
  }

  if (file.startsWith("src/") || file.startsWith("app/")) {
    return !isTestFile(file) && /\.(ts|tsx|js|jsx|json)$/.test(file);
  }

  if (file.startsWith("android/")) {
    return true;
  }

  if (file.startsWith("assets/")) {
    return true;
  }

  return [
    "babel.config.js",
    "eas.json",
    "google-services.json",
    "metro.config.js",
    "react-native.config.js",
    "tamagui.config.ts",
  ].includes(file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
}

function getVersionMetadataFromGradleSource(source) {
  const versionCode = source.match(/\bversionCode\s+(\d+)/)?.[1];
  const versionName = source.match(/\bversionName\s+["']([^"']+)["']/)?.[1];
  return {
    versionCode: versionCode ? Number(versionCode) : null,
    versionName: versionName ?? null,
  };
}

function getGradleVersionMetadata() {
  const source = fs.readFileSync(path.join(ROOT, "android", "app", "build.gradle"), "utf8");
  return getVersionMetadataFromGradleSource(source);
}

function readFileAtRef(ref, file) {
  try {
    return runGit(["show", `${ref}:${file}`]);
  } catch {
    return null;
  }
}

function readJsonAtRef(ref, file) {
  const source = readFileAtRef(ref, file);
  return source ? JSON.parse(source) : null;
}

function normalizeVersionFile(file, source) {
  if (file === "app.json") {
    const parsed = JSON.parse(source);
    if (parsed.expo) {
      delete parsed.expo.version;
      if (parsed.expo.android) {
        delete parsed.expo.android.versionCode;
      }
    }
    return JSON.stringify(parsed);
  }

  if (file === "package.json") {
    const parsed = JSON.parse(source);
    delete parsed.version;
    return JSON.stringify(parsed);
  }

  if (file === "package-lock.json") {
    const parsed = JSON.parse(source);
    delete parsed.version;
    if (parsed.packages?.[""]) {
      delete parsed.packages[""].version;
    }
    return JSON.stringify(parsed);
  }

  if (file === "android/app/build.gradle") {
    return source
      .replace(/\bversionCode\s+\d+/g, "versionCode <version>")
      .replace(/\bversionName\s+["'][^"']+["']/g, "versionName <version>");
  }

  return source;
}

function isOnlyReleaseMetadataChanged(base, file) {
  const baseSource = readFileAtRef(base, file);
  if (baseSource === null) {
    return false;
  }

  const currentSource = fs.readFileSync(path.join(ROOT, file), "utf8");
  return normalizeVersionFile(file, baseSource) === normalizeVersionFile(file, currentSource);
}

function compareSemver(left, right) {
  const leftParts = String(left).split(".").map((part) => Number(part));
  const rightParts = String(right).split(".").map((part) => Number(part));
  if (
    leftParts.length !== 3 ||
    rightParts.length !== 3 ||
    leftParts.some((part) => !Number.isInteger(part) || part < 0) ||
    rightParts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    return null;
  }

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

const appJson = readJson("app.json");
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const gradle = getGradleVersionMetadata();

const appVersion = appJson.expo?.version;
const packageVersion = packageJson.version;
const lockVersion = packageLock.version;
const lockRootVersion = packageLock.packages?.[""]?.version;
const appVersionCode = appJson.expo?.android?.versionCode;

const consistencyErrors = [];
if (appVersion !== packageVersion || lockVersion !== packageVersion || lockRootVersion !== packageVersion) {
  consistencyErrors.push(
    `Version mismatch: app.json=${appVersion}, package.json=${packageVersion}, package-lock root=${lockVersion}, package-lock package=${lockRootVersion}.`,
  );
}

if (gradle.versionName !== packageVersion) {
  consistencyErrors.push(`Android versionName (${gradle.versionName}) must match package/app version (${packageVersion}).`);
}

if (!Number.isInteger(appVersionCode) || appVersionCode <= 0) {
  consistencyErrors.push("app.json expo.android.versionCode must be a positive integer.");
}

if (!Number.isInteger(gradle.versionCode) || gradle.versionCode <= 0) {
  consistencyErrors.push("android/app/build.gradle versionCode must be a positive integer.");
}

if (appVersionCode !== gradle.versionCode) {
  consistencyErrors.push(`Android versionCode mismatch: app.json=${appVersionCode}, Gradle=${gradle.versionCode}.`);
}

if (consistencyErrors.length > 0) {
  console.error("Version metadata check failed:");
  for (const error of consistencyErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const base = getComparisonBase();
const changedFiles = getChangedFiles(base);
const deploymentChanges = changedFiles.filter(
  (file) => isDeploymentImpacting(file) || (base && VERSION_FILES.has(file) && !isOnlyReleaseMetadataChanged(base, file)),
);
const versionChanges = changedFiles.filter((file) => VERSION_FILES.has(file));

if (base && deploymentChanges.length > 0 && versionChanges.length === 0) {
  console.error(`Deployment-impacting changes require a version bump relative to ${base}.`);
  console.error("Deployment-impacting files:");
  for (const file of deploymentChanges) {
    console.error(`- ${file}`);
  }
  console.error("Update app.json, package.json/package-lock.json, and android/app/build.gradle version metadata.");
  process.exit(1);
}

if (base && deploymentChanges.length > 0) {
  const basePackageJson = readJsonAtRef(base, "package.json");
  const baseGradleSource = readFileAtRef(base, "android/app/build.gradle");
  const baseGradle = baseGradleSource ? getVersionMetadataFromGradleSource(baseGradleSource) : null;
  const semverComparison = basePackageJson ? compareSemver(packageVersion, basePackageJson.version) : null;

  const bumpErrors = [];
  if (semverComparison === null) {
    bumpErrors.push(`Could not compare package version ${packageVersion} against base version ${basePackageJson?.version}.`);
  } else if (semverComparison <= 0) {
    bumpErrors.push(`Package/app version must increase above ${basePackageJson.version}; current version is ${packageVersion}.`);
  }

  if (!baseGradle || !Number.isInteger(baseGradle.versionCode)) {
    bumpErrors.push("Could not read base Android versionCode.");
  } else if (gradle.versionCode <= baseGradle.versionCode) {
    bumpErrors.push(`Android versionCode must increase above ${baseGradle.versionCode}; current versionCode is ${gradle.versionCode}.`);
  }

  if (bumpErrors.length > 0) {
    console.error(`Deployment-impacting changes require an actual version increase relative to ${base}.`);
    for (const error of bumpErrors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
}

if (!base) {
  console.warn("Version bump comparison skipped because no git base ref was available.");
}

console.log("Version metadata check passed.");
