import type { DraftRecord } from "../../storage/records";
import type { AppSettings, BackupFrequency } from "../../storage/settings";

export const BACKUP_SCHEMA_VERSION = 1 as const;
export const BACKUP_FILE_EXTENSION = "sbbk";
export const BACKUP_MIME_TYPE = "application/octet-stream";
export const BACKUP_DAILY_MANUAL_LIMIT = 3;

export type BackupSnapshotV1 = {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  createdAt: string;
  appVersion: string;
  deviceLocale: string;
  compression: "gzip";
  encryption:
    | { enabled: false }
    | {
        enabled: true;
        algorithm: "xsalsa20poly1305";
        kdf: {
          name: "pbkdf2";
          hash: "sha256";
          iterations: number;
          keyLength: number;
        };
        saltBase64: string;
        nonceBase64: string;
      };
  payloadBase64: string;
};

export type BackupDataPayload = {
  settings: AppSettings;
  records: DraftRecord[];
};

export type BackupRunOptions = {
  passphrase?: string;
  preferredDirectoryUri?: string;
  includeGoogleDriveUpload?: boolean;
  allowDirectoryPrompt?: boolean;
};

export type BackupRunResult = {
  fileUri: string;
  fileName: string;
  directoryUri: string;
  uploadedToGoogleDrive: boolean;
  snapshot: BackupSnapshotV1;
};

export type ParsedBackupSnapshot = {
  snapshot: BackupSnapshotV1;
  data: BackupDataPayload;
};

export type BackupStatusReason =
  | "ok"
  | "backup-disabled"
  | "manual-backup-limit-reached"
  | "missing-backup-passphrase"
  | "import-cancelled"
  | "invalid-backup-file"
  | "unsupported-backup-version"
  | "backup-restore-failed"
  | "google-drive-auth-failed"
  | "google-drive-upload-failed"
  | "google-drive-disabled"
  | "unknown-error";

export type BackupScheduleRunResult = {
  ran: boolean;
  reason:
    | "not-due"
    | "disabled"
    | "missing-passphrase"
    | "run-succeeded"
    | "run-failed";
};

export function isFrequencyDue(
  frequency: BackupFrequency,
  lastRunIso: string | undefined,
  now: Date,
) {
  if (!lastRunIso) {
    return true;
  }

  const lastDate = new Date(lastRunIso);
  if (!Number.isFinite(lastDate.getTime())) {
    return true;
  }

  const diffMs = now.getTime() - lastDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (frequency === "daily") {
    return diffMs >= dayMs;
  }
  if (frequency === "weekly") {
    return diffMs >= 7 * dayMs;
  }
  return diffMs >= 30 * dayMs;
}

export function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
