import { cloneDeep, getDeviceLocale } from "./device";

describe("device helpers", () => {
  it("returns a locale string", () => {
    expect(typeof getDeviceLocale()).toBe("string");
    expect(getDeviceLocale().length).toBeGreaterThan(0);
  });

  it("falls back when locale resolution fails", () => {
    const original = Intl.DateTimeFormat;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Intl as any).DateTimeFormat = () => {
      throw new Error("boom");
    };

    expect(getDeviceLocale()).toBe("en-US");
    Intl.DateTimeFormat = original;
  });

  it("falls back when locale resolution returns an empty string", () => {
    const original = Intl.DateTimeFormat;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Intl as any).DateTimeFormat = () => ({
      resolvedOptions: () => ({
        locale: "",
      }),
    });

    expect(getDeviceLocale()).toBe("en-US");
    Intl.DateTimeFormat = original;
  });

  it("deep clones serializable values", () => {
    const original = { nested: { value: 1 } };
    const cloned = cloneDeep(original);

    cloned.nested.value = 2;

    expect(original.nested.value).toBe(1);
    expect(cloned.nested.value).toBe(2);
  });
});
