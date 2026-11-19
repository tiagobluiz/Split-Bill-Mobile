import { withAppDatabaseRetry, withDatabaseTransaction } from "./database";
import type { SQLiteDatabase } from "expo-sqlite";
import { parseObject } from "./personIdentity";
import {
  getDefaultTranslationSettings,
  normalizeLanguage,
  type AppLanguage,
} from "../i18n";
import { getDeviceLocale } from "../lib/device";
import { normalizeTags, type SplitTag } from "../features/split/tags";

export type AppSettings = {
  balanceFeatureEnabled: boolean;
  defaultCurrency: string;
  pdfDownloadDirectoryUri?: string;
  language: AppLanguage;
  splitListAmountDisplay: SplitListAmountDisplay;
  tags?: SplitTag[];
  customCurrencies: Array<{
    code: string;
    name: string;
    symbol: string;
  }>;
};

export type SplitListAmountDisplay =
  | "remaining"
  | "total"
  | "userPaid"
  | "totalAndRemaining";

const SETTINGS_KEY = "app-settings";

const DEFAULT_SPLIT_LIST_AMOUNT_DISPLAY: SplitListAmountDisplay = "remaining";

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
    balanceFeatureEnabled: true,
    defaultCurrency: "EUR",
    language: translationDefaults.language,
    splitListAmountDisplay: DEFAULT_SPLIT_LIST_AMOUNT_DISPLAY,
    tags: normalizeTags(undefined),
    customCurrencies: [],
  };
}

export async function initializeSettingsStorage() {
  await withAppDatabaseRetry(async (db) => {
    const existing = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_settings'");
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS release_announcements (
        key TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL
      );
    `);
    if (!existing) {
      await db.runAsync("INSERT OR IGNORE INTO release_announcements (key, payload) VALUES (?, ?)", ["whats-new-seen", JSON.stringify(require("../../app.json").expo.version)]);
    }
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

  let parsed: Partial<AppSettings> & { trackPaymentsFeatureEnabled?: unknown };
  try {
    const payload = JSON.parse(row.payload) as unknown;
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return getDefaultSettings();
    }
    parsed = payload as Partial<AppSettings> & { trackPaymentsFeatureEnabled?: unknown };
  } catch {
    return getDefaultSettings();
  }
  if (Object.prototype.hasOwnProperty.call(parsed, "humour")) {
    try {
      await withDatabaseTransaction(async (db) => {
        const current = await db.getFirstAsync<SettingsRow>("SELECT key, payload FROM app_settings WHERE key = ?", [SETTINGS_KEY]);
        if (!current) return;
        const payload = JSON.parse(current.payload);
        if (!payload || typeof payload !== "object" || Array.isArray(payload) || !("humour" in payload)) return;
        delete payload.humour;
        await db.runAsync("UPDATE app_settings SET payload = ? WHERE key = ?", [JSON.stringify(payload), SETTINGS_KEY]);
      });
    } catch (error) {
      console.warn("[Split Bill storage] Could not remove legacy tone", error);
    }
  }
  const balanceFeatureEnabled = typeof parsed.trackPaymentsFeatureEnabled === "boolean"
    ? parsed.trackPaymentsFeatureEnabled
    : typeof parsed.balanceFeatureEnabled === "boolean" ? parsed.balanceFeatureEnabled : true;

  const pdfDownloadDirectoryUri =
    typeof parsed.pdfDownloadDirectoryUri === "string" &&
    parsed.pdfDownloadDirectoryUri.trim()
      ? parsed.pdfDownloadDirectoryUri.trim()
      : undefined;

  const splitListAmountDisplay = normalizeSplitListAmountDisplay(parsed.splitListAmountDisplay);
  const settings: AppSettings = {
    balanceFeatureEnabled,
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
    splitListAmountDisplay: !balanceFeatureEnabled &&
      (splitListAmountDisplay === "remaining" || splitListAmountDisplay === "totalAndRemaining")
      ? "total"
      : splitListAmountDisplay,
    tags: normalizeTags(parsed.tags),
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
  return settings;
}

export async function writeAppSettings(db: SQLiteDatabase, patch: Partial<AppSettings>) {
  const row = await db.getFirstAsync<{ payload: string }>(
    "SELECT payload FROM app_settings WHERE key = ?", [SETTINGS_KEY],
  );
  const current = row ? parseObject(row.payload, "settings") : {};
  const payload = { ...current };
  for (const key of ["balanceFeatureEnabled", "defaultCurrency", "pdfDownloadDirectoryUri",
    "language", "splitListAmountDisplay", "tags", "customCurrencies"] as const) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) Object.assign(payload, { [key]: patch[key] });
  }
  if (patch.balanceFeatureEnabled !== undefined) delete payload.trackPaymentsFeatureEnabled;
  if (patch.tags) payload.tags = normalizeTags(patch.tags);
  if (patch.splitListAmountDisplay !== undefined) {
    payload.splitListAmountDisplay = normalizeSplitListAmountDisplay(patch.splitListAmountDisplay);
  }
  await db.runAsync(
    `INSERT INTO app_settings (key, payload)
     VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload`,
    [SETTINGS_KEY, JSON.stringify(payload)],
  );
}

export async function saveAppSettings(patch: Partial<AppSettings>) {
  await withDatabaseTransaction((db) => writeAppSettings(db, patch));
}
