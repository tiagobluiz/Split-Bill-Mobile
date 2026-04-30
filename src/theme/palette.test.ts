import { FONTS, PALETTE } from "./palette";

describe("theme palette", () => {
  it("exposes the expected palette and font tokens", () => {
    expect(PALETTE.primary).toBe("#9d4401");
    expect(PALETTE.secondary).toBe("#71452c");
    expect(PALETTE.surfaceContainerHighest).toBe("#e4d3c4");
    expect(PALETTE.success).toBe("#0d7c67");
    expect(FONTS.headlineBlack).toBe("PublicSans_900Black");
    expect(FONTS.bodyBold).toBe("Inter_700Bold");
  });
});
