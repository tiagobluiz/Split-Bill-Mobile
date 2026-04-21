import { formatPercentValue, normalizeCommittedPercentValue } from "./recordUtils";

describe("recordUtils", () => {
  it("returns a safe fallback for non-finite percent values", () => {
    expect(formatPercentValue(Number.NaN)).toBe("0");
  });

  it("returns a safe fallback for empty committed percent values", () => {
    expect(normalizeCommittedPercentValue("")).toBe("0");
  });
});
