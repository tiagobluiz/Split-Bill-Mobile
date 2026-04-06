import { FONTS, PALETTE } from "./palette";

describe("theme palette", () => {
  it("exposes the expected palette and font tokens", () => {
    expect(PALETTE.primary).toBe("#9d4401");
    expect(PALETTE.secondary).toBe("#006a60");
    expect(PALETTE.surfaceContainerHighest).toBe("#e2e2e2");
    expect(FONTS.headlineBlack).toBe("PublicSans_900Black");
    expect(FONTS.bodyBold).toBe("Inter_700Bold");
  });
});
