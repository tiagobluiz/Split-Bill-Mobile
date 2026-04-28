import {
  SUPPORTED_HUMOURS,
  SUPPORTED_LANGUAGES,
  translationCatalog,
  type AppHumour,
  type AppLanguage,
  type TranslationKey,
} from "./catalog";

export type TranslateParams = Record<string, string | number | undefined>;
export type TranslateOptions = {
  fallbackTone?: AppHumour;
  maxLength?: number;
};

export type TranslationSettings = {
  language: AppLanguage;
  humour: AppHumour;
};

const DEFAULT_LANGUAGE: AppLanguage = "en";
const DEFAULT_HUMOUR: AppHumour = "plain";

let runtimeSettings: TranslationSettings = {
  language: DEFAULT_LANGUAGE,
  humour: DEFAULT_HUMOUR,
};

function interpolate(template: string, params?: TranslateParams) {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_match, token: string) => {
    const value = params[token];
    return value === undefined ? "" : String(value);
  });
}

export function normalizeLanguage(value: unknown): AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage)
    ? (value as AppLanguage)
    : DEFAULT_LANGUAGE;
}

export function normalizeHumour(value: unknown): AppHumour {
  return SUPPORTED_HUMOURS.includes(value as AppHumour)
    ? (value as AppHumour)
    : DEFAULT_HUMOUR;
}

export function resolveLanguageFromLocale(locale?: string): AppLanguage {
  const prefix = locale?.trim().toLowerCase().split(/[-_]/)[0];
  return prefix === "pt" ? "pt" : DEFAULT_LANGUAGE;
}

export function getDefaultTranslationSettings(
  locale?: string,
): TranslationSettings {
  return {
    language: resolveLanguageFromLocale(locale),
    humour: DEFAULT_HUMOUR,
  };
}

export function setI18nRuntime(settings: Partial<TranslationSettings>) {
  runtimeSettings = {
    language: normalizeLanguage(settings.language ?? runtimeSettings.language),
    humour: normalizeHumour(settings.humour ?? runtimeSettings.humour),
  };
}

export function getI18nRuntime() {
  return runtimeSettings;
}

export function translateWithSettings(
  settings: TranslationSettings,
  key: TranslationKey,
  params?: TranslateParams,
  options?: TranslateOptions,
) {
  const language = normalizeLanguage(settings.language);
  const humour = normalizeHumour(settings.humour);
  const fallbackTone = normalizeHumour(options?.fallbackTone ?? "plain");
  const languageCatalog = translationCatalog[language];
  const defaultCatalog = translationCatalog[DEFAULT_LANGUAGE];
  const defaultResolved = defaultCatalog.plain[key] as string;

  let resolved =
    languageCatalog[humour][key] ??
    languageCatalog[fallbackTone][key] ??
    defaultResolved;

  const safeResolved = resolved ?? defaultResolved;

  if (options?.maxLength && safeResolved.length > options.maxLength) {
    resolved = languageCatalog[fallbackTone][key] ?? defaultResolved;
  } else {
    resolved = safeResolved;
  }

  return interpolate(resolved ?? defaultResolved, params);
}

export function t(
  key: TranslationKey,
  params?: TranslateParams,
  options?: TranslateOptions,
) {
  return translateWithSettings(runtimeSettings, key, params, options);
}

export type { AppHumour, AppLanguage, TranslationKey };
