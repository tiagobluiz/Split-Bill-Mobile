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

export function isMobileUserAgent(userAgent: string) {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
}

export function getReceiptLlmProviderUrl(provider: LlmProvider, isMobile = false) {
  return isMobile ? MOBILE_PROVIDER_URLS[provider] : DESKTOP_PROVIDER_URLS[provider];
}

export function getReceiptLlmLaunchTarget(isMobile = false) {
  return isMobile ? "_self" : "_blank";
}

export function buildReceiptLlmPrompt() {
  return [
    "Read the uploaded grocery receipt and extract only the purchased receipt items.",
    "Return the result in this exact format, one item per line:",
    "Item name - 2.49",
    "",
    "Rules:",
    "- Keep only real purchasable items.",
    "- Exclude totals, subtotals, taxes, VAT summaries, payment lines, loyalty-card savings, discounts from another card, headers, and notes.",
    "- Do not add commentary, numbering, markdown, tables, or explanations.",
    "- Use a plain decimal number for the price.",
    "- If the receipt uses comma decimals, convert them to dot decimals.",
  ].join("\n");
}
