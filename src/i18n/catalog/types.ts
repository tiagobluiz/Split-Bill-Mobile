export const SUPPORTED_LANGUAGES = ["en", "pt"] as const;
export const SUPPORTED_HUMOURS = ["plain", "sassy", "unhinged"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type AppHumour = (typeof SUPPORTED_HUMOURS)[number];

export type CopyValue = string;
export type TranslationMap = Record<string, CopyValue>;
