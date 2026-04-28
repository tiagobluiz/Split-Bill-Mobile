import { getI18nRuntime, translateWithSettings, type TranslationSettings } from "../i18n";

export type LlmProvider = "chatgpt" | "claude" | "gemini";

const DESKTOP_PROVIDER_URLS: Record<LlmProvider, string> = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/",
  gemini: "https://gemini.google.com/app",
};

const MOBILE_PROVIDER_URLS: Record<LlmProvider, string> = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/",
  gemini: "https://gemini.google.com/",
};

const ANDROID_PROVIDER_PACKAGES: Record<LlmProvider, string> = {
  chatgpt: "com.openai.chatgpt",
  claude: "com.anthropic.claude",
  gemini: "com.google.android.apps.bard",
};

export function isMobileUserAgent(userAgent: string) {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
}

export function getReceiptLlmProviderUrl(provider: LlmProvider, isMobile = false) {
  return isMobile ? MOBILE_PROVIDER_URLS[provider] : DESKTOP_PROVIDER_URLS[provider];
}

export function getReceiptLlmAndroidPackage(provider: LlmProvider) {
  return ANDROID_PROVIDER_PACKAGES[provider];
}

export function getReceiptLlmLaunchTarget(isMobile = false) {
  return isMobile ? "_self" : "_blank";
}

export function buildReceiptLlmPrompt(settings: TranslationSettings = getI18nRuntime()) {
  return [
    translateWithSettings(settings, "llm.receiptPrompt.readReceipt"),
    translateWithSettings(settings, "llm.receiptPrompt.returnFormat"),
    "Item name - 2.49",
    "",
    translateWithSettings(settings, "llm.receiptPrompt.rules"),
    translateWithSettings(settings, "llm.receiptPrompt.rule.keepItems"),
    translateWithSettings(settings, "llm.receiptPrompt.rule.excludeNonItems"),
    translateWithSettings(settings, "llm.receiptPrompt.rule.noCommentary"),
    translateWithSettings(settings, "llm.receiptPrompt.rule.plainDecimal"),
    translateWithSettings(settings, "llm.receiptPrompt.rule.commaToDot"),
  ].join("\n");
}
