export const SUPPORTED_LANGUAGES = ["en", "pt"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export type CopyValue = string;
export type TranslationMap = Record<string, CopyValue>;
