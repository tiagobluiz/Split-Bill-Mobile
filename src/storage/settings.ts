import { withAppDatabaseRetry } from "./database";
import {
  getDefaultTranslationSettings,
  normalizeHumour,
  normalizeLanguage,
  type AppHumour,
  type AppLanguage,
} from "../i18n";
import { getDeviceLocale } from "../lib/device";

export type AppSettings = {
  ownerName: string;
  ownerProfileImageUri: string;
  balanceFeatureEnabled: boolean;
  trackPaymentsFeatureEnabled: boolean;
  defaultCurrency: string;
  pdfDownloadDirectoryUri?: string;
  language: AppLanguage;
  humour: AppHumour;
  splitListAmountDisplay: SplitListAmountDisplay;
  backup?: BackupSettings;
  customCurrencies: Array<{
    code: string;
    name: string;
    symbol: string;
  }>;
};

export type BackupFrequency = "daily" | "weekly" | "monthly";

export type BackupLastResult = {
  ok: boolean;
  at: string;
  reason?: string;
};

export type BackupSettings = {
  enabled: boolean;
  frequency: BackupFrequency;
  encryptionEnabled: boolean;
  localDirectoryUri?: string;
  manualQuota: {
    dayKey: string;
    used: number;
  };
  lastManualBackupAt?: string;
  lastAutoBackupAt?: string;
  lastBackupResult?: BackupLastResult;
  googleDrive: {
    connected: boolean;
    accountEmail?: string;
  };
};

export type SplitListAmountDisplay =
  | "remaining"
  | "total"
  | "userPaid"
  | "totalAndRemaining";

type FeatureFlags = Pick<AppSettings, "balanceFeatureEnabled" | "trackPaymentsFeatureEnabled">;

export function normalizeFeatureFlags(flags: FeatureFlags): FeatureFlags {
  if (!flags.trackPaymentsFeatureEnabled) {
    return {
      balanceFeatureEnabled: false,
      trackPaymentsFeatureEnabled: false,
    };
  }

  if (flags.balanceFeatureEnabled) {
    return {
      balanceFeatureEnabled: true,
      trackPaymentsFeatureEnabled: true,
    };
  }

  return {
    balanceFeatureEnabled: false,
    trackPaymentsFeatureEnabled: true,
  };
}

const SETTINGS_KEY = "app-settings";

const DEFAULT_SPLIT_LIST_AMOUNT_DISPLAY: SplitListAmountDisplay = "remaining";
const DEFAULT_BACKUP_FREQUENCY: BackupFrequency = "daily";

function normalizeBackupFrequency(value: unknown): BackupFrequency {
  return value === "weekly" || value === "monthly"
    ? value
    : DEFAULT_BACKUP_FREQUENCY;
}

function normalizeIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const date = new Date(trimmed);
  if (!Number.isFinite(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

export function getDefaultBackupSettings(): BackupSettings {
  return {
    enabled: false,
    frequency: DEFAULT_BACKUP_FREQUENCY,
    encryptionEnabled: false,
    manualQuota: {
      dayKey: "",
      used: 0,
    },
    googleDrive: {
      connected: false,
    },
  };
}

function normalizeBackupSettings(value: unknown): BackupSettings {
  const defaults = getDefaultBackupSettings();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const payload = value as Partial<BackupSettings>;
  const dayKey =
    typeof payload.manualQuota?.dayKey === "string"
      ? payload.manualQuota.dayKey.trim()
      : "";
  const used = Number.isFinite(payload.manualQuota?.used)
    ? Math.max(0, Math.floor(payload.manualQuota!.used))
    : 0;
  const accountEmail =
    typeof payload.googleDrive?.accountEmail === "string" &&
    payload.googleDrive.accountEmail.trim()
      ? payload.googleDrive.accountEmail.trim()
      : undefined;
  const localDirectoryUri =
    typeof payload.localDirectoryUri === "string" &&
    payload.localDirectoryUri.trim()
      ? payload.localDirectoryUri.trim()
      : undefined;
  const connected = Boolean(payload.googleDrive?.connected);
  const lastResultAt = normalizeIsoTimestamp(payload.lastBackupResult?.at);
  const lastResult =
    typeof payload.lastBackupResult?.ok === "boolean" && lastResultAt
      ? {
          ok: payload.lastBackupResult.ok,
          at: lastResultAt,
          ...(typeof payload.lastBackupResult.reason === "string" &&
          payload.lastBackupResult.reason.trim()
            ? { reason: payload.lastBackupResult.reason.trim() }
            : {}),
        }
      : undefined;

  return {
    enabled: Boolean(payload.enabled),
    frequency: normalizeBackupFrequency(payload.frequency),
    encryptionEnabled: Boolean(payload.encryptionEnabled),
    ...(localDirectoryUri ? { localDirectoryUri } : {}),
    manualQuota: {
      dayKey,
      used,
    },
    ...(normalizeIsoTimestamp(payload.lastManualBackupAt)
      ? { lastManualBackupAt: normalizeIsoTimestamp(payload.lastManualBackupAt) }
      : {}),
    ...(normalizeIsoTimestamp(payload.lastAutoBackupAt)
      ? { lastAutoBackupAt: normalizeIsoTimestamp(payload.lastAutoBackupAt) }
      : {}),
    ...(lastResult ? { lastBackupResult: lastResult } : {}),
    googleDrive: {
      connected,
      ...(connected && accountEmail ? { accountEmail } : {}),
    },
  };
}

function normalizeSplitListAmountDisplay(
  value: unknown,
): SplitListAmountDisplay {
  return value === "total" ||
    value === "userPaid" ||
    value === "totalAndRemaining"
    ? value
    : DEFAULT_SPLIT_LIST_AMOUNT_DISPLAY;
}

function getDefaultSettings(): AppSettings {
  const translationDefaults = getDefaultTranslationSettings(getDeviceLocale());
  return {
    ownerName: "You",
    ownerProfileImageUri: "",
    balanceFeatureEnabled: true,
    trackPaymentsFeatureEnabled: true,
    defaultCurrency: "EUR",
    language: translationDefaults.language,
    humour: translationDefaults.humour,
    splitListAmountDisplay: DEFAULT_SPLIT_LIST_AMOUNT_DISPLAY,
    backup: getDefaultBackupSettings(),
    customCurrencies: [],
  };
}

export async function initializeSettingsStorage() {
  await withAppDatabaseRetry(async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL
      );
    `);
  });
}

type SettingsRow = {
  key: string;
  payload: string;
};

export async function getAppSettings() {
  const translationDefaults = getDefaultTranslationSettings(getDeviceLocale());
  const row = await withAppDatabaseRetry((db) =>
    db.getFirstAsync<SettingsRow>(
      "SELECT key, payload FROM app_settings WHERE key = ?",
      [SETTINGS_KEY]
    )
  );
  if (!row) {
    return getDefaultSettings();
  }

  let parsed: Partial<AppSettings>;
  try {
    const payload = JSON.parse(row.payload) as unknown;
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return getDefaultSettings();
    }
    parsed = payload as Partial<AppSettings>;
  } catch {
    return getDefaultSettings();
  }
  const normalizedFlags = normalizeFeatureFlags({
    balanceFeatureEnabled:
      typeof parsed.balanceFeatureEnabled === "boolean" ? parsed.balanceFeatureEnabled : true,
    trackPaymentsFeatureEnabled:
      typeof parsed.trackPaymentsFeatureEnabled === "boolean" ? parsed.trackPaymentsFeatureEnabled : true,
  });

  const pdfDownloadDirectoryUri =
    typeof parsed.pdfDownloadDirectoryUri === "string" &&
    parsed.pdfDownloadDirectoryUri.trim()
      ? parsed.pdfDownloadDirectoryUri.trim()
      : undefined;

  return {
    ownerName: typeof parsed.ownerName === "string" && parsed.ownerName.trim() ? parsed.ownerName.trim() : "You",
    ownerProfileImageUri:
      typeof parsed.ownerProfileImageUri === "string" ? parsed.ownerProfileImageUri.trim() : "",
    balanceFeatureEnabled: normalizedFlags.balanceFeatureEnabled,
    trackPaymentsFeatureEnabled: normalizedFlags.trackPaymentsFeatureEnabled,
    defaultCurrency:
      typeof parsed.defaultCurrency === "string" && parsed.defaultCurrency.trim()
        ? parsed.defaultCurrency.trim().toUpperCase()
        : "EUR",
    ...(pdfDownloadDirectoryUri
      ? { pdfDownloadDirectoryUri }
      : {}),
    language:
      parsed.language === undefined
        ? translationDefaults.language
        : normalizeLanguage(parsed.language),
    humour:
      parsed.humour === undefined
        ? translationDefaults.humour
        : normalizeHumour(parsed.humour),
    splitListAmountDisplay: normalizeSplitListAmountDisplay(
      parsed.splitListAmountDisplay,
    ),
    backup: normalizeBackupSettings(parsed.backup),
    customCurrencies: Array.isArray(parsed.customCurrencies)
      ? parsed.customCurrencies
          .filter(
            (entry): entry is { code: string; name: string; symbol: string } =>
              typeof entry?.code === "string" &&
              Boolean(entry.code.trim()) &&
              typeof entry?.name === "string" &&
              Boolean(entry.name.trim()) &&
              typeof entry?.symbol === "string" &&
              Boolean(entry.symbol.trim())
          )
          .map((entry) => ({
            code: entry.code.trim().toUpperCase(),
            name: entry.name.trim(),
            symbol: entry.symbol.trim(),
          }))
      : [],
  };
}

export async function saveAppSettings(settings: AppSettings) {
  const normalizedFlags = normalizeFeatureFlags({
    balanceFeatureEnabled: settings.balanceFeatureEnabled,
    trackPaymentsFeatureEnabled: settings.trackPaymentsFeatureEnabled,
  });
  const payload: AppSettings = {
    ...settings,
    ...normalizedFlags,
    splitListAmountDisplay: normalizeSplitListAmountDisplay(
      settings.splitListAmountDisplay,
    ),
    backup: normalizeBackupSettings(settings.backup),
  };
  await withAppDatabaseRetry((db) =>
    db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, payload)
       VALUES (?, ?)`,
      [SETTINGS_KEY, JSON.stringify(payload)]
    )
  );
}

export async function clearAppSettings() {
  await withAppDatabaseRetry((db) =>
    db.runAsync("DELETE FROM app_settings WHERE key = ?", [SETTINGS_KEY]),
  );
}
