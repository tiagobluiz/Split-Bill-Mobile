import { isValidSplitDate, localDay } from "./splitDate";

it("validates real calendar dates including leap days", () => {
  expect(isValidSplitDate("2024-02-29")).toBe(true);
  expect(isValidSplitDate("2026-02-29")).toBe(false);
  expect(isValidSplitDate("2026-13-01")).toBe(false);
  expect(isValidSplitDate("2026-1-01")).toBe(false);
});

it("uses local calendar components across a daylight-saving change", () => {
  expect(localDay(new Date(2026, 2, 29, 0, 1))).toBe("2026-03-29");
  expect(localDay(new Date(2026, 2, 29, 23, 59))).toBe("2026-03-29");
});
