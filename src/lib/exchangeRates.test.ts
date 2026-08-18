import { fetchExchangeRate } from "./exchangeRates";

describe("fetchExchangeRate", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("returns a fallback rate without fetching when currencies match", async () => {
    await expect(fetchExchangeRate(" eur ", "EUR")).resolves.toEqual({
      rate: 1,
      source: "fallback",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns the fetched target currency rate", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn(async () => ({ rates: { USD: 1.25 } })),
    });

    await expect(fetchExchangeRate("eur", "usd")).resolves.toEqual({
      rate: 1.25,
      source: "auto",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.frankfurter.app/latest?from=EUR&to=USD",
      { signal: expect.any(AbortSignal) },
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it("falls back when the response is not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: jest.fn(),
    });

    await expect(fetchExchangeRate("EUR", "USD")).resolves.toEqual({
      rate: 1,
      source: "fallback",
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("falls back when the fetched rate is missing or invalid", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn(async () => ({ rates: { USD: 0 } })),
    });

    await expect(fetchExchangeRate("EUR", "USD")).resolves.toEqual({
      rate: 1,
      source: "fallback",
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("clears the abort timer and falls back when fetch throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));

    await expect(fetchExchangeRate("EUR", "USD")).resolves.toEqual({
      rate: 1,
      source: "fallback",
    });
    expect(jest.getTimerCount()).toBe(0);
  });
});
