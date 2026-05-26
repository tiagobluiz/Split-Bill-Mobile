import { normalizeInternalRoute } from "./internalRoute";

describe("normalizeInternalRoute", () => {
  it("returns empty fallback for non-string values", () => {
    expect(normalizeInternalRoute(undefined)).toBe("");
    expect(normalizeInternalRoute(undefined, { emptyFallback: "/" })).toBe("/");
  });

  it("normalizes absolute deep links", () => {
    expect(
      normalizeInternalRoute("split-bill-mobile:///split/draft-1/results"),
    ).toBe("/split/draft-1/results");
  });

  it("keeps host-based deep link first segment", () => {
    expect(
      normalizeInternalRoute("split-bill-mobile://split/draft-1/results"),
    ).toBe("/split/draft-1/results");
  });

  it("preserves query and hash", () => {
    expect(
      normalizeInternalRoute(
        "split-bill-mobile:///split/draft-1/results?reminder=true#top",
      ),
    ).toBe("/split/draft-1/results?reminder=true#top");
  });

  it("maps expo development client to root", () => {
    expect(normalizeInternalRoute("expo-development-client:///")).toBe("/");
  });

  it("normalizes malformed candidates", () => {
    expect(normalizeInternalRoute("some-invalid-path")).toBe(
      "/some-invalid-path",
    );
  });
});

