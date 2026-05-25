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

  it("keeps relative app routes as-is", () => {
    expect(
      redirectSystemPath({ path: "/split/draft-1/results", initial: true }),
    ).toBe("/split/draft-1/results");
  });
});
