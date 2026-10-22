import { withAppDatabaseRetry, withDatabaseTransaction } from "./database";
import { assertPersonRegistry } from "./personIdentity";
import {
  getDefaultTranslationSettings,
  normalizeHumour,
  normalizeLanguage,
  type AppHumour,
  type AppLanguage,
} from "../i18n";
import { getDeviceLocale } from "../lib/device";
import { normalizeTags, type SplitTag } from "../features/split/tags";
import {
  normalizeGroups,
  normalizePeople,
  type ParticipantGroup,
  type SavedPerson,
} from "../features/split/people";

export type AppSettings = {
  ownerName: string;
  ownerPersonId?: string;
  ownerProfileImageUri: string;
  balanceFeatureEnabled: boolean;
  trackPaymentsFeatureEnabled: boolean;
  defaultCurrency: string;
  pdfDownloadDirectoryUri?: string;
  language: AppLanguage;
  humour: AppHumour;
  splitListAmountDisplay: SplitListAmountDisplay;
  tags?: SplitTag[];
  people?: SavedPerson[];
  participantGroups?: ParticipantGroup[];
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
    tags: normalizeTags(undefined),
    people: [],
    participantGroups: [],
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

  const people = normalizePeople(parsed.people);
  const participantGroups = normalizeGroups(parsed.participantGroups, people);

  return {
    ownerName: typeof parsed.ownerName === "string" && parsed.ownerName.trim() ? parsed.ownerName.trim() : "You",
    ...(typeof parsed.ownerPersonId === "string" ? { ownerPersonId: parsed.ownerPersonId } : {}),
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
    tags: normalizeTags(parsed.tags),
    people,
    participantGroups,
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

export function buildSettingsPayload(settings: AppSettings): AppSettings {
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
    ...(settings.tags ? { tags: normalizeTags(settings.tags) } : {}),
    ...(settings.people ? { people: normalizePeople(settings.people) } : {}),
    ...(settings.participantGroups
      ? {
          participantGroups: normalizeGroups(
            settings.participantGroups,
            normalizePeople(settings.people),
          ),
        }
      : {}),
  };
  return payload;
}

export async function saveAppSettings(settings: AppSettings) {
  assertPersonRegistry(settings);
  const payload = buildSettingsPayload(settings);
  await withDatabaseTransaction(async (db) => {
    const references = await db.getAllAsync<{ person_id: string }>("SELECT DISTINCT person_id FROM split_person_memberships");
    const ids = new Set((payload.people ?? []).map((person) => person.id));
    if (references.some((reference) => !ids.has(reference.person_id)) || (payload.ownerPersonId && !ids.has(payload.ownerPersonId))) {
      throw new Error("Cannot remove a referenced person");
    }
    await db.runAsync(
      `INSERT INTO app_settings (key, payload)
       VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload`,
      [SETTINGS_KEY, JSON.stringify(payload)]
    );
  });
}
