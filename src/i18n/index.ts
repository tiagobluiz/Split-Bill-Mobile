import {
  SUPPORTED_LANGUAGES,
  translationCatalog,
  type AppLanguage,
  type TranslationKey,
} from "./catalog";

export type TranslateParams = Record<string, string | number | undefined>;
export type TranslateOptions = {
  maxLength?: number;
};

export type TranslationSettings = {
  language: AppLanguage;
};

const DEFAULT_LANGUAGE: AppLanguage = "en";

let runtimeSettings: TranslationSettings = {
  language: DEFAULT_LANGUAGE,
};

function interpolate(template: unknown, params?: TranslateParams) {
  const safeTemplate = typeof template === "string" ? template : "";
  if (!params) {
    return safeTemplate;
  }

  return safeTemplate.replace(/\{(\w+)\}/g, (_match, token: string) => {
    const value = params[token];
    return value === undefined ? "" : String(value);
  });
}

export function normalizeLanguage(value: unknown): AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage)
    ? (value as AppLanguage)
    : DEFAULT_LANGUAGE;
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
  };
}

export function setI18nRuntime(settings: Partial<TranslationSettings>) {
  runtimeSettings = {
    language: normalizeLanguage(settings.language ?? runtimeSettings.language),
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
  const languageCatalog = translationCatalog[language];
  const defaultCatalog = translationCatalog[DEFAULT_LANGUAGE];
  const defaultResolved =
    typeof defaultCatalog[key] === "string"
      ? (defaultCatalog[key] as string)
      : String(key);
  const maxLength = options?.maxLength;

  const candidates = [
    languageCatalog[key],
    defaultResolved,
  ].filter(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.length > 0,
  );

  const resolved = maxLength
    ? candidates.find((candidate) => candidate.length <= maxLength) ??
      defaultResolved
    : candidates[0] ?? defaultResolved;

  return interpolate(resolved ?? defaultResolved, params);
}

export function t(
  key: TranslationKey,
  params?: TranslateParams,
  options?: TranslateOptions,
) {
  return translateWithSettings(runtimeSettings, key, params, options);
}

export type { AppLanguage, TranslationKey };
