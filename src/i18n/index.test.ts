import { getDefaultTranslationSettings, translateWithSettings } from "./index";

describe("i18n", () => {
  it("resolves plain copy in both languages", () => {
    expect(translateWithSettings({ language: "en" }, "home.startSplit")).toBe("Start New Split");
    expect(translateWithSettings({ language: "pt" }, "home.startSplit")).toBe("Nova divisão");
  });
  it("retains length fallback and interpolation", () => {
    expect(translateWithSettings({ language: "pt" }, "home.startSplit", undefined, { maxLength: 5 })).toBe("Start New Split");
    expect(translateWithSettings({ language: "pt" }, "validation.participantNameMax", { max: 25 })).toBe("Mantém os nomes abaixo de 25 caracteres.");
  });
  it("derives language from the device locale", () => {
    expect(getDefaultTranslationSettings("pt-PT")).toEqual({ language: "pt" });
    expect(getDefaultTranslationSettings("en-US")).toEqual({ language: "en" });
  });
});
