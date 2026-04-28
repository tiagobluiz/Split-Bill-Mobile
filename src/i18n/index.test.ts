import {
  getDefaultTranslationSettings,
  translateWithSettings,
} from "./index";

describe("i18n", () => {
  it("resolves the exact language and humour variant", () => {
    expect(
      translateWithSettings(
        { language: "en", humour: "sassy" },
        "home.startSplit",
      ),
    ).toBe("Start something you’ll regret");
  });

  it("falls back to plain humour when the variant is missing", () => {
    expect(
      translateWithSettings(
        { language: "en", humour: "sassy" },
        "settings.save",
      ),
    ).toBe("Save Settings");
  });

  it("falls back to plain humour when the requested variant is too long", () => {
    expect(
      translateWithSettings(
        { language: "en", humour: "sassy" },
        "home.startSplit",
        undefined,
        { maxLength: 12 },
      ),
    ).toBe("Start New Split");
  });

  it("interpolates params", () => {
    expect(
      translateWithSettings(
        { language: "pt", humour: "plain" },
        "validation.participantNameMax",
        { max: 25 },
      ),
    ).toBe("Mantém os nomes abaixo de 25 caracteres.");
  });

  it("supports the unhinged english tone", () => {
    expect(
      translateWithSettings(
        { language: "en", humour: "unhinged" },
        "flow.results.title",
      ),
    ).toBe("Here’s the damage");
  });

  it("derives the initial language from device locale", () => {
    expect(getDefaultTranslationSettings("pt-PT")).toEqual({
      language: "pt",
      humour: "plain",
    });
    expect(getDefaultTranslationSettings("en-US")).toEqual({
      language: "en",
      humour: "plain",
    });
  });
});
