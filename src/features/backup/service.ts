import * as DocumentPicker from "expo-document-picker";
import * as LegacyFileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import naclUtil from "tweetnacl-util";

import type { DraftRecord } from "../../storage/records";
import {
  getDefaultBackupSettings,
  type AppSettings,
} from "../../storage/settings";
import { getDeviceLocale } from "../../lib/device";
import { decodeBackupSnapshot, encodeBackupSnapshot } from "./codec";
import {
  BACKUP_DAILY_MANUAL_LIMIT,
  BACKUP_FILE_EXTENSION,
  BACKUP_MIME_TYPE,
  type BackupDataPayload,
  type BackupRunOptions,
  type BackupRunResult,
  type BackupScheduleRunResult,
  type BackupSnapshotV1,
  type ParsedBackupSnapshot,
  getLocalDayKey,
  isFrequencyDue,
} from "./types";
import { uploadBackupToGoogleDrive } from "./googleDrive";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getBackupSettings(settings: AppSettings) {
  return settings.backup ?? getDefaultBackupSettings();
}

function createBackupFileName(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `split-bill-backup-${year}${month}${day}-${hours}${minutes}${seconds}.${BACKUP_FILE_EXTENSION}`;
}

function splitFileNameAndExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0) {
    return {
      baseName: fileName,
      extension: "",
    };
  }
  return {
    baseName: fileName.slice(0, lastDot),
    extension: fileName.slice(lastDot + 1),
  };
}

async function writeSnapshotToSafDirectory(
  directoryUri: string,
  fileName: string,
  snapshotText: string,
) {
  const parsed = splitFileNameAndExtension(fileName);
  const destinationUri = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    parsed.baseName,
    BACKUP_MIME_TYPE,
  );
  const base64 = naclUtil.encodeBase64(textEncoder.encode(snapshotText));
  await LegacyFileSystem.writeAsStringAsync(destinationUri, base64, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });
  return {
    fileUri: destinationUri,
    directoryUri,
  };
}

async function selectSafDirectory(
  preferredDirectoryUri?: string,
  allowPrompt = true,
) {
  if (preferredDirectoryUri?.trim()) {
    return preferredDirectoryUri.trim();
  }
  if (!allowPrompt) {
    return null;
  }

  const permission =
    await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted || !permission.directoryUri) {
    return null;
  }
  return permission.directoryUri;
}

async function writeSnapshotToLocalStorage(
  snapshotText: string,
  options: BackupRunOptions,
) {
  const fileName = createBackupFileName();
  const safDirectory = await selectSafDirectory(
    options.preferredDirectoryUri,
    options.allowDirectoryPrompt !== false,
  );
  if (safDirectory) {
    const saved = await writeSnapshotToSafDirectory(
      safDirectory,
      fileName,
      snapshotText,
    );
    return {
      fileUri: saved.fileUri,
      fileName,
      directoryUri: saved.directoryUri,
    };
  }

  const directoryUri = LegacyFileSystem.documentDirectory ?? "file://";
  const fileUri = `${directoryUri}${fileName}`;
  await LegacyFileSystem.writeAsStringAsync(fileUri, snapshotText);
  return {
    fileUri,
    fileName,
    directoryUri,
  };
}

export function createBackupSnapshot(
  payload: BackupDataPayload,
  passphrase?: string,
): BackupSnapshotV1 {
  const createdAt = new Date().toISOString();
  return encodeBackupSnapshot(payload, {
    createdAt,
    appVersion:
      Constants.expoConfig?.version ??
      Constants.nativeAppVersion ??
      "1.0.0",
    deviceLocale: getDeviceLocale(),
    passphrase,
  });
}

export async function runBackupNow(
  payload: BackupDataPayload,
  options: BackupRunOptions = {},
): Promise<BackupRunResult> {
  const snapshot = createBackupSnapshot(payload, options.passphrase);
  const snapshotText = JSON.stringify(snapshot);
  const saved = await writeSnapshotToLocalStorage(snapshotText, options);
  let uploadedToGoogleDrive = false;
  if (options.includeGoogleDriveUpload) {
    await uploadBackupToGoogleDrive(saved.fileName, snapshotText);
    uploadedToGoogleDrive = true;
  }
  return {
    fileUri: saved.fileUri,
    fileName: saved.fileName,
    directoryUri: saved.directoryUri,
    uploadedToGoogleDrive,
    snapshot,
  };
}

function isSnapshotShape(value: unknown): value is BackupSnapshotV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const payload = value as Partial<BackupSnapshotV1>;
  return (
    payload.schemaVersion === 1 &&
    typeof payload.createdAt === "string" &&
    typeof payload.appVersion === "string" &&
    typeof payload.deviceLocale === "string" &&
    payload.compression === "gzip" &&
    typeof payload.payloadBase64 === "string" &&
    Boolean(payload.encryption)
  );
}

export function parseBackupSnapshot(
  rawSnapshotText: string,
  passphrase?: string,
): ParsedBackupSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawSnapshotText);
  } catch {
    throw new Error("invalid-backup-file");
  }
  if (!isSnapshotShape(parsed)) {
    throw new Error("invalid-backup-file");
  }
  if (parsed.schemaVersion !== 1) {
    throw new Error("unsupported-backup-version");
  }
  const data = decodeBackupSnapshot(parsed, passphrase) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("invalid-backup-file");
  }
  const payload = data as Partial<BackupDataPayload>;
  if (!payload.settings || !Array.isArray(payload.records)) {
    throw new Error("invalid-backup-file");
  }
  return {
    snapshot: parsed,
    data: {
      settings: payload.settings as AppSettings,
      records: payload.records as DraftRecord[],
    },
  };
}

async function readFileContent(uri: string) {
  try {
    return await LegacyFileSystem.readAsStringAsync(uri);
  } catch {
    const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    return textDecoder.decode(naclUtil.decodeBase64(base64));
  }
}

export async function pickAndParseBackupFile(
  passphrase?: string,
): Promise<ParsedBackupSnapshot> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "application/octet-stream", "*/*"],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.length) {
    throw new Error("import-cancelled");
  }

  const selected = picked.assets[0];
  const content = await readFileContent(selected.uri);
  return parseBackupSnapshot(content, passphrase);
}

export function getNextManualQuota(
  settings: AppSettings,
  now = new Date(),
): {
  allowed: boolean;
  dayKey: string;
  used: number;
  nextUsed: number;
} {
  const backup = getBackupSettings(settings);
  const dayKey = getLocalDayKey(now);
  const currentQuota =
    backup.manualQuota.dayKey === dayKey
      ? backup.manualQuota.used
      : 0;
  const used = Math.max(0, currentQuota);
  const allowed = used < BACKUP_DAILY_MANUAL_LIMIT;
  return {
    allowed,
    dayKey,
    used,
    nextUsed: allowed ? used + 1 : used,
  };
}

export function shouldRunScheduledBackup(settings: AppSettings, now = new Date()) {
  const backup = getBackupSettings(settings);
  if (!backup.enabled) {
    return false;
  }
  return isFrequencyDue(backup.frequency, backup.lastAutoBackupAt, now);
}

export function getScheduledBackupDecision(
  settings: AppSettings,
  hasPassphrase: boolean,
  now = new Date(),
): BackupScheduleRunResult {
  const backup = getBackupSettings(settings);
  if (!backup.enabled) {
    return { ran: false, reason: "disabled" };
  }
  if (!shouldRunScheduledBackup(settings, now)) {
    return { ran: false, reason: "not-due" };
  }
  if (backup.encryptionEnabled && !hasPassphrase) {
    return { ran: false, reason: "missing-passphrase" };
  }
  return { ran: true, reason: "run-succeeded" };
}
