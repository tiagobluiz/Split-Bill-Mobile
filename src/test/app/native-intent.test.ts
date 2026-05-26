import { redirectSystemPath } from "../../../app/+native-intent";

describe("native intent redirects", () => {
  it("falls back to root for empty launch paths", () => {
    expect(
      redirectSystemPath({ path: "split-bill-mobile:///", initial: true }),
    ).toBe("/");
  });

  it("strips scheme from absolute deep links", () => {
    expect(
      redirectSystemPath({
        path: "split-bill-mobile:///split/draft-1/results",
        initial: true,
      }),
    ).toBe("/split/draft-1/results");
  });

  it("keeps the first segment for host-based scheme deep links", () => {
    expect(
      redirectSystemPath({
        path: "split-bill-mobile://split/draft-1/results",
        initial: true,
      }),
    ).toBe("/split/draft-1/results");
  });

  it("preserves query strings and hashes from deep links", () => {
    expect(
      redirectSystemPath({
        path: "split-bill-mobile:///split/draft-1/results?reminder=true#top",
        initial: true,
      }),
    ).toBe("/split/draft-1/results?reminder=true#top");
  });

  it("handles expo-development-client URLs", () => {
    expect(
      redirectSystemPath({
        path: "expo-development-client:///",
        initial: true,
      }),
    ).toBe("/");
  });

  it("normalizes malformed paths and trims whitespace", () => {
    expect(
      redirectSystemPath({
        path: "   split-bill-mobile:///split/draft-1/results   ",
        initial: true,
      }),
    ).toBe("/split/draft-1/results");
    expect(
      redirectSystemPath({
        path: "some-invalid-path",
        initial: true,
      }),
    ).toBe("/some-invalid-path");
  });

  it("keeps relative app routes as-is", () => {
    expect(
      redirectSystemPath({ path: "/split/draft-1/results", initial: true }),
    ).toBe("/split/draft-1/results");
  });
});
