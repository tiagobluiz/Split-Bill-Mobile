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
  language: AppLanguage;
  humour: AppHumour;
  splitListAmountDisplay: SplitListAmountDisplay;
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
    language: normalizeLanguage(parsed.language),
    humour: normalizeHumour(parsed.humour),
    splitListAmountDisplay: normalizeSplitListAmountDisplay(
      parsed.splitListAmountDisplay,
    ),
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
  };
  await withAppDatabaseRetry((db) =>
    db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, payload)
       VALUES (?, ?)`,
      [SETTINGS_KEY, JSON.stringify(payload)]
    )
  );
}
