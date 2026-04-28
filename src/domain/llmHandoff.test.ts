import { buildReceiptLlmPrompt, getReceiptLlmLaunchTarget, getReceiptLlmProviderUrl, isMobileUserAgent } from "./llmHandoff";

describe("llm handoff contract", () => {
  it("detects mobile user agents", () => {
    expect(isMobileUserAgent("Mozilla/5.0 (iPhone)")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (Windows NT 10.0)")).toBe(false);
  });

  it("returns desktop and mobile provider urls", () => {
    expect(getReceiptLlmProviderUrl("claude")).toBe("https://claude.ai/");
    expect(getReceiptLlmProviderUrl("chatgpt", false)).toBe("https://chatgpt.com/");
    expect(getReceiptLlmProviderUrl("claude", true)).toBe("https://claude.ai/");
    expect(getReceiptLlmProviderUrl("gemini", false)).toBe("https://gemini.google.com/app");
    expect(getReceiptLlmProviderUrl("gemini", true)).toBe("https://gemini.google.com/");
  });

  it("returns launch target based on platform", () => {
    expect(getReceiptLlmLaunchTarget()).toBe("_blank");
    expect(getReceiptLlmLaunchTarget(true)).toBe("_self");
    expect(getReceiptLlmLaunchTarget(false)).toBe("_blank");
  });

  it("matches the documented prompt text", () => {
    expect(buildReceiptLlmPrompt()).toContain("Read the uploaded grocery receipt");
    expect(buildReceiptLlmPrompt()).toContain("Item name - 2.49");
    expect(buildReceiptLlmPrompt()).toContain("Do not add commentary");
  });

  it("translates the prompt when translation settings are provided", () => {
    const prompt = buildReceiptLlmPrompt({
      language: "pt",
      humour: "plain",
    });
    const englishPrompt = buildReceiptLlmPrompt({
      language: "en",
      humour: "plain",
    });

    expect(prompt).not.toBe(englishPrompt);
    expect(prompt).toContain("Regras:");
    expect(prompt).toContain("Item name - 2.49");
    expect(prompt).not.toContain("Do not add commentary");
  });
});
