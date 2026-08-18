const mockGetCalendars = jest.fn();

jest.mock("expo-localization", () => ({
  getCalendars: () => mockGetCalendars(),
}));

import {
  cloneDeep,
  getDeviceLanguage,
  getDeviceLocale,
  prefers24HourTime,
} from "./device";

describe("device helpers", () => {
  const originalDateTimeFormat = Intl.DateTimeFormat;

  beforeEach(() => {
    mockGetCalendars.mockReset();
    mockGetCalendars.mockReturnValue([]);
  });

  afterEach(() => {
    Intl.DateTimeFormat = originalDateTimeFormat;
  });

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

  it("detects 24-hour preference from localization calendar flags", () => {
    mockGetCalendars.mockReturnValue([{ uses24hourClock: true }]);
    expect(prefers24HourTime()).toBe(true);

    mockGetCalendars.mockReturnValue([{ uses24HourClock: false }]);
    expect(prefers24HourTime()).toBe(false);
  });

  it("detects 24-hour preference from Intl hour options", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Intl as any).DateTimeFormat = () => ({
      resolvedOptions: () => ({
        hour12: false,
        locale: "en-US",
      }),
    });
    expect(prefers24HourTime()).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Intl as any).DateTimeFormat = () => ({
      resolvedOptions: () => ({
        hour12: true,
        locale: "en-US",
      }),
    });
    expect(prefers24HourTime()).toBe(false);
  });

  it("detects 24-hour preference from hour cycle and locale extension fallbacks", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Intl as any).DateTimeFormat = () => ({
      resolvedOptions: () => ({
        hourCycle: "h24",
        locale: "en-US",
      }),
    });
    expect(prefers24HourTime()).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Intl as any).DateTimeFormat = () => ({
      resolvedOptions: () => ({
        hourCycle: "h12",
        locale: "en-US",
      }),
    });
    expect(prefers24HourTime()).toBe(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Intl as any).DateTimeFormat = () => ({
      resolvedOptions: () => ({
        locale: "en-US-u-hc-h23",
      }),
    });
    expect(prefers24HourTime()).toBe(true);
  });

  it("falls back to non-24-hour time when preference detection fails", () => {
    mockGetCalendars.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(prefers24HourTime()).toBe(false);
  });

  it("returns the normalized device language", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Intl as any).DateTimeFormat = () => ({
      resolvedOptions: () => ({
        locale: "pt-PT",
      }),
    });
    expect(getDeviceLanguage()).toBe("pt");
  });
});
