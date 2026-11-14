import { computeSettlement, createDefaultValues } from "../../../../domain";
import type { DraftRecord } from "../../../../storage/records";

import { getHomeBalanceCards, getHomeBalanceCardsFromEntries, getHomeBalanceEntry, getRecentRowMeta, getRecordMoneyPreview, type HomeBalanceCache } from "./settlementUtils";

function buildRecord(overrides?: Partial<DraftRecord>): DraftRecord {
  return {
    id: "draft-1",
    status: "draft",
    step: 1,
    values: createDefaultValues(),
    settlementState: { settledParticipantIds: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("settlementUtils", () => {
  it("shows a personal balance only when the owner participates, even when others owe money", () => {
    const values = {
      ...createDefaultValues(), currency: "EUR",
      participants: [{ id: "payer", name: "Maya" }, { id: "other", name: "Alex" }],
      payerParticipantId: "payer",
      items: [{ id: "item", name: "Item", price: "202000.00", splitMode: "even" as const,
        allocations: ["payer", "other"].map((participantId) => ({ participantId, evenIncluded: true, shares: "1", percent: "50" })) }],
    };
    const record = buildRecord({ status: "completed", values, settlementState: { settledParticipantIds: [] } });
    expect(getRecordMoneyPreview(record, "Tiago")).toMatchObject({ totalDebtCents: 10100000, unsettledDebtCents: 10100000, ownerNetCents: 0, ownerRelation: "none" });
    expect(getRecentRowMeta(record, "Tiago", { defaultCurrency: "EUR", splitListAmountDisplay: "remaining" }).amountDisplay).toMatchObject({ primaryKind: "nothingDue" });
    expect(getRecordMoneyPreview(record, "Alex")).toMatchObject({ ownerNetCents: 10100000, ownerRelation: "debtor" });
  });
  it("keeps correct compact balances across payments, currencies and missing exchange rates", () => {
    const values = {
      ...createDefaultValues(), currency: "USD",
      participants: [{ id: "owner", name: "You" }, { id: "friend", name: "Ana" }],
      payerParticipantId: "owner",
      items: [{ id: "i", name: "Dinner", price: "10.00", splitMode: "even" as const,
        allocations: ["owner", "friend"].map((participantId) => ({ participantId, evenIncluded: true, shares: "1", percent: "50" })) }],
    };
    const converted = buildRecord({ id: "converted", values: { ...values, exchangeRate: { sourceCurrency: "USD", targetCurrency: "EUR", rate: 0.5 } } });
    const unconverted = buildRecord({ id: "unconverted", values });
    const paid = buildRecord({ id: "paid", values: converted.values, settlementState: { settledParticipantIds: ["friend"] } });
    const invalid = buildRecord({ id: "invalid" });
    const entries = [invalid, converted, unconverted, paid].map((record) => getHomeBalanceEntry(record, "You", "EUR"));
    expect(getHomeBalanceCardsFromEntries(entries, "EUR")).toEqual({ currency: "EUR", owedCents: 250, oweCents: 0 });
    const noMatchingRate = [invalid, converted, unconverted, paid].map((record) => getHomeBalanceEntry(record, "You", "GBP"));
    expect(getHomeBalanceCardsFromEntries(noMatchingRate, "GBP")).toEqual({ currency: "USD", owedCents: 1000, oweCents: 0 });
    expect(entries.map((entry) => entry.preview?.ownerNetCents ?? 0)).toEqual([0, 250, 500, 0]);
    expect(entries.map((entry) => entry.filterOwnerNetCents)).toEqual([0, 500, 500, 0]);
    const rounded = buildRecord({ id: "rounded", values: { ...values, exchangeRate: { sourceCurrency: "USD", targetCurrency: "EUR", rate: 0.0001 } } });
    expect(getHomeBalanceEntry(rounded, "You", "EUR")).toMatchObject({ filterOwnerNetCents: 500, preview: { ownerNetCents: 0 } });
  });
  it("updates balances after payment while reusing unchanged split calculations", () => {
    const values = {
      ...createDefaultValues(),
      currency: "EUR",
      participants: [{ id: "owner", name: "You" }, { id: "friend", name: "Ana" }],
      payerParticipantId: "owner",
      items: [{
        id: "item", name: "Dinner", price: "10.00", splitMode: "even" as const,
        allocations: ["owner", "friend"].map((participantId) => ({ participantId, evenIncluded: true, shares: "1", percent: "50" })),
      }],
    };
    const first = buildRecord({ id: "first", values });
    const second = buildRecord({ id: "second", values });
    const resolver = jest.fn((record: DraftRecord) => computeSettlement(record.values));
    const cache: HomeBalanceCache = new WeakMap();

    expect(getHomeBalanceCards([first, second], "You", "EUR", resolver, cache).owedCents).toBe(1000);
    const paid = { ...first, settlementState: { settledParticipantIds: ["friend"] } };
    expect(getHomeBalanceCards([paid, second], "You", "EUR", resolver, cache).owedCents).toBe(500);
    expect(resolver).toHaveBeenCalledTimes(3);
    getHomeBalanceCards([paid, second], "Ana", "EUR", resolver, cache);
    expect(resolver).toHaveBeenCalledTimes(5);
  });

  it("uses default settlement resolver when a custom resolver is not provided", () => {
    const preview = getRecordMoneyPreview(buildRecord(), "Ana");
    expect(preview).toBeNull();
  });

  it("converts preview net amount into app currency when exchangeRate is present", () => {
    const preview = getRecordMoneyPreview(
      buildRecord({
        values: {
          ...createDefaultValues(),
          currency: "USD",
          exchangeRate: {
            sourceCurrency: "USD",
            targetCurrency: "EUR",
            rate: 0.5,
          },
          participants: [
            { id: "payer", name: "You" },
            { id: "ana", name: "Ana" },
          ],
          payerParticipantId: "payer",
          items: [
            {
              id: "i1",
              name: "Dinner",
              price: "10.00",
              splitMode: "even",
              allocations: [
                { participantId: "payer", evenIncluded: true, shares: "1", percent: "50" },
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "50" },
              ],
            },
          ],
        },
        status: "completed",
      }),
      "You",
    );
    expect(preview?.ownerNetCents).toBe(500);
  });
});
