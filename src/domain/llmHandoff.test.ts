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
    const prompt = buildReceiptLlmPrompt();

    expect(prompt).toContain("Read the uploaded grocery receipt");
    expect(prompt).toContain("Return the result in this exact format:\nItem name - 2.49");
    expect(prompt).toContain("Return the result inside a plain-text code block");
    expect(prompt).toContain("Exactly one purchased item per physical line");
    expect(prompt).toContain("Do not put more than one item on the same physical line");
    expect(prompt).toContain("Do not add commentary, numbering, tables, or explanations");
    expect(prompt).not.toContain("markdown");
    expect(prompt).not.toContain("Return exactly one item per line");
    expect(prompt).toContain(
      "Keep the item name, including spaces and all characters, at most 54 characters",
    );
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
    expect(prompt).toContain("Devolve o resultado dentro de um bloco de código em texto simples");
    expect(prompt).toContain("Exatamente um item comprado por linha física");
    expect(prompt).toContain("Não ponhas mais do que um item na mesma linha física");
    expect(prompt).toContain(
      "Mantém o nome do item, incluindo espaços e todos os caracteres, no máximo 54 caracteres",
    );
    expect(prompt).not.toContain("Do not add commentary");
  });
});
