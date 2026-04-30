export type ExchangeRateResult = {
  rate: number;
  source: "auto" | "fallback";
};

export async function fetchExchangeRate(
  sourceCurrency: string,
  targetCurrency: string,
): Promise<ExchangeRateResult> {
  const source = sourceCurrency.trim().toUpperCase();
  const target = targetCurrency.trim().toUpperCase();
  if (!source || !target || source === target) {
    return { rate: 1, source: "fallback" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(source)}&to=${encodeURIComponent(target)}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!response.ok) {
      return { rate: 1, source: "fallback" };
    }
    const payload = (await response.json()) as { rates?: Record<string, number> };
    const result = payload?.rates?.[target];
    if (!Number.isFinite(result) || result <= 0) {
      return { rate: 1, source: "fallback" };
    }
    return { rate: result, source: "auto" };
  } catch {
    return { rate: 1, source: "fallback" };
  }
}
