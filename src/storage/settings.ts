import * as SQLite from "expo-sqlite";

export type AppSettings = {
  ownerName: string;
  ownerProfileImageUri: string;
  balanceFeatureEnabled: boolean;
  defaultCurrency: string;
  customCurrencies: Array<{
    code: string;
    name: string;
    symbol: string;
  }>;
};

const DATABASE_NAME = "split-bill-mobile.db";
const SETTINGS_KEY = "app-settings";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDefaultSettings(): AppSettings {
  return {
    ownerName: "You",
    ownerProfileImageUri: "",
    balanceFeatureEnabled: true,
    defaultCurrency: "EUR",
    customCurrencies: [],
  };
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  return databasePromise;
}

export async function initializeSettingsStorage() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL
    );
  `);
}

type SettingsRow = {
  key: string;
  payload: string;
};

export async function getAppSettings() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SettingsRow>(
    "SELECT key, payload FROM app_settings WHERE key = ?",
    [SETTINGS_KEY]
  );
  if (!row) {
    return getDefaultSettings();
  }

  const parsed = JSON.parse(row.payload) as Partial<AppSettings>;
  return {
    ownerName: typeof parsed.ownerName === "string" && parsed.ownerName.trim() ? parsed.ownerName : "You",
    ownerProfileImageUri:
      typeof parsed.ownerProfileImageUri === "string" ? parsed.ownerProfileImageUri.trim() : "",
    balanceFeatureEnabled:
      typeof parsed.balanceFeatureEnabled === "boolean" ? parsed.balanceFeatureEnabled : true,
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
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO app_settings (key, payload)
     VALUES (?, ?)`,
    [SETTINGS_KEY, JSON.stringify(settings)]
  );
}
