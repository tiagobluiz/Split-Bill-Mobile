import { withAppDatabaseRetry } from "./database";

export type AppSettings = {
  ownerName: string;
  ownerProfileImageUri: string;
  balanceFeatureEnabled: boolean;
  trackPaymentsFeatureEnabled: boolean;
  defaultCurrency: string;
  customCurrencies: Array<{
    code: string;
    name: string;
    symbol: string;
  }>;
};

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

function getDefaultSettings(): AppSettings {
  return {
    ownerName: "You",
    ownerProfileImageUri: "",
    balanceFeatureEnabled: true,
    trackPaymentsFeatureEnabled: true,
    defaultCurrency: "EUR",
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
  };
  await withAppDatabaseRetry((db) =>
    db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, payload)
       VALUES (?, ?)`,
      [SETTINGS_KEY, JSON.stringify(payload)]
    )
  );
}
