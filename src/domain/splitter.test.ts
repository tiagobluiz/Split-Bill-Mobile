import aggregateFixture from "../../docs/logic/fixtures/split-aggregate-rounding.json";
import percentFixture from "../../docs/logic/fixtures/percent-rebalance-sequence.json";
import evenFixture from "../../docs/logic/fixtures/split-even-basic.json";
import payerBiasFixture from "../../docs/logic/fixtures/split-shares-payer-bias.json";

import {
  buildShareSummary,
  computeSettlement,
  createAllocation,
  createDefaultPercentValues,
  createDefaultValues,
  createEmptyItem,
  createId,
  detectCurrency,
  formatMoney,
  formatMoneyTrailingSymbol,
  parseMoneyToCents,
  parseSplit,
  rebalancePercentAllocations,
  removeSingleTrailingBlankItem,
  resetPercentAllocations,
  resetShareAllocations,
  syncItemAllocations,
  validateStepOne,
  validateStepThree,
  validateStepTwo,
  type SplitFormValues,
} from "./splitter";

describe("splitter domain", () => {
  it("parses money inputs documented in the contract", () => {
    expect(parseMoneyToCents("3.49")).toBe(349);
    expect(parseMoneyToCents("3,49")).toBe(349);
    expect(parseMoneyToCents(" 1 234,56 ")).toBe(123456);
    expect(parseMoneyToCents("-0.75")).toBe(-75);
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("3.999")).toBeNull();
  });

  it("uses crypto ids when available and falls back otherwise", () => {
    const originalCrypto = globalThis.crypto;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).crypto = { randomUUID: () => "crypto-id" };
    expect(createId()).toBe("crypto-id");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).crypto;
    expect(createId()).toMatch(/^id-/);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).crypto = originalCrypto;
  });

  it("matches the even split fixture", () => {
    expect(parseSplit(evenFixture.input as SplitFormValues)).toEqual({
      ok: true,
      data: evenFixture.expected.parseSplit,
    });
    expect(computeSettlement(evenFixture.input as SplitFormValues)).toEqual({
      ok: true,
      data: {
        ...evenFixture.expected.computeSettlement,
        itemBreakdown: evenFixture.expected.parseSplit.items,
      },
    });
  });

  it("biases leftover cents away from the payer at item level", () => {
    const parsed = parseSplit(payerBiasFixture.input as SplitFormValues);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.data.items[0]?.shares).toEqual(payerBiasFixture.expected.parseSplitItemShares);
    expect(computeSettlement(payerBiasFixture.input as SplitFormValues)).toEqual({
      ok: true,
      data: {
        currency: payerBiasFixture.input.currency,
        itemBreakdown: [
          {
            id: payerBiasFixture.input.items[0].id,
            name: payerBiasFixture.input.items[0].name,
            amountCents: 100,
            splitMode: "shares",
            shares: payerBiasFixture.expected.parseSplitItemShares,
          },
        ],
        people: payerBiasFixture.expected.computeSettlementPeople,
        transfers: payerBiasFixture.expected.transfers,
        totalCents: 100,
      },
    });
  });

  it("rounds final totals from aggregate exact shares", () => {
    const parsed = parseSplit(aggregateFixture.input as SplitFormValues);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.data.items[0]?.shares).toEqual(aggregateFixture.expected.perItemShares);
    expect(computeSettlement(aggregateFixture.input as SplitFormValues)).toEqual({
      ok: true,
      data: {
        currency: aggregateFixture.input.currency,
        itemBreakdown: expect.any(Array),
        people: aggregateFixture.expected.authoritativePeople,
        transfers: aggregateFixture.expected.transfers,
        totalCents: 800,
      },
    });
  });

  it("matches the documented percent rebalance sequence", () => {
    let allocations = percentFixture.initialAllocations;

    percentFixture.operations.forEach((operation) => {
      allocations = rebalancePercentAllocations(
        allocations,
        operation.changedParticipantId,
        operation.nextPercentValue
      )!;
      expect(allocations).toEqual(operation.expectedAllocations);
    });
  });

  it("covers defaults, formatting, and synchronization behavior", () => {
    expect(detectCurrency("pt-PT")).toBe("EUR");
    expect(detectCurrency("zz-ZZ")).toBe("EUR");
    expect(detectCurrency()).toBe("USD");
    expect(createDefaultValues("en-US").currency).toBe("USD");
    expect(formatMoney(1234, "PTS", "en-US")).toMatch(/PTS\s?12\.34/);
    expect(formatMoneyTrailingSymbol(1234, "PTS", "en-US")).toBe("12.34PTS");
    expect(createDefaultPercentValues(0)).toEqual([]);
    expect(createDefaultPercentValues(3)).toEqual(["33.34", "33.33", "33.33"]);
    expect(createAllocation("ana")).toEqual({
      participantId: "ana",
      evenIncluded: false,
      shares: "0",
      percent: "0",
      percentLocked: false,
    });

    const item = createEmptyItem([
      { id: "ana", name: "Ana" },
      { id: "bruno", name: "Bruno" },
    ]);

    expect(item.splitMode).toBe("even");
    expect(item.allocations).toHaveLength(2);
    expect(item.allocations.every((allocation) => !allocation.evenIncluded && allocation.shares === "0")).toBe(true);

    const synced = syncItemAllocations(
      [
        {
          ...item,
          allocations: [
            { participantId: "ana", evenIncluded: true, shares: "2", percent: "75" },
            { participantId: "ghost", evenIncluded: true, shares: "1", percent: "25", percentLocked: true },
          ],
        },
      ],
      [
        { id: "ana", name: "Ana" },
        { id: "carla", name: "Carla" },
      ]
    );

    expect(synced[0].allocations).toEqual([
      { participantId: "ana", evenIncluded: true, shares: "2", percent: "75", percentLocked: false },
      { participantId: "carla", evenIncluded: false, shares: "0", percent: "50", percentLocked: false },
    ]);

    expect(resetShareAllocations(synced[0].allocations).map((entry) => entry.shares)).toEqual(["1", "1"]);
    expect(resetPercentAllocations(synced[0].allocations).map((entry) => entry.percent)).toEqual(["50", "50"]);
    expect(formatMoney(349, "EUR")).toContain("3.49");
    expect(formatMoneyTrailingSymbol(349, "EUR")).toBeTruthy();
    expect(formatMoney(349, "EUR", "en-US")).toBe("€3.49");
    expect(formatMoneyTrailingSymbol(349, "EUR", "pt-PT")).toContain("€");
  });

  it("falls back when Intl formatting throws", () => {
    const originalNumberFormat = Intl.NumberFormat;
    // @ts-expect-error test override
    Intl.NumberFormat = jest.fn(() => {
      throw new Error("boom");
    });

    expect(formatMoney(1234, "PTS", "en-US")).toBe("PTS 12.34");
    expect(formatMoneyTrailingSymbol(1234, "PTS", "en-US")).toBe("12.34PTS");

    Intl.NumberFormat = originalNumberFormat;
  });

  it("covers validation failures and invalid settlement branches", () => {
    const invalidValues: SplitFormValues = {
      currency: "EUR",
      participants: [
        { id: "a", name: "  " },
        { id: "b", name: "Ana" },
        { id: "c", name: "ana" },
      ],
      payerParticipantId: "missing",
      items: [
        {
          id: "i1",
          name: "",
          price: "0",
          splitMode: "even",
          allocations: [
            { participantId: "a", evenIncluded: false, shares: "1", percent: "0", percentLocked: false },
            { participantId: "b", evenIncluded: false, shares: "-1", percent: "60", percentLocked: false },
            { participantId: "c", evenIncluded: false, shares: "0", percent: "20", percentLocked: false },
          ],
        },
      ],
    };

    expect(validateStepOne(invalidValues).map((entry) => entry.message)).toEqual(
      expect.arrayContaining([
        "Add a name for each participant.",
        "Participant names must be unique.",
        "The selected payer must be one of the participants.",
      ])
    );
    expect(validateStepTwo(invalidValues).map((entry) => entry.message)).toEqual(
      expect.arrayContaining(["This item needs a name.", "Enter a valid amount different from zero."])
    );
    expect(validateStepThree(invalidValues).map((entry) => entry.message)).toEqual(
      expect.arrayContaining(["Choose at least one participant for an even split."])
    );
    expect(parseSplit(invalidValues).ok).toBe(false);
    expect(computeSettlement(invalidValues).ok).toBe(false);
  });

  it("covers shares and percent validation edge cases", () => {
    const sharesInvalid: SplitFormValues = {
      currency: "EUR",
      participants: [
        { id: "ana", name: "Ana" },
        { id: "bruno", name: "Bruno" },
      ],
      payerParticipantId: "ana",
      items: [
        {
          id: "shares-1",
          name: "Cheese",
          price: "1.00",
          splitMode: "shares",
          allocations: [
            { participantId: "ana", evenIncluded: true, shares: "-1", percent: "50", percentLocked: false },
            { participantId: "bruno", evenIncluded: true, shares: "0", percent: "50", percentLocked: false },
          ],
        },
      ],
    };

    const percentInvalid: SplitFormValues = {
      ...sharesInvalid,
      items: [
        {
          id: "percent-1",
          name: "Juice",
          price: "2.00",
          splitMode: "percent",
          allocations: [
            { participantId: "ana", evenIncluded: true, shares: "1", percent: "-10", percentLocked: false },
            { participantId: "bruno", evenIncluded: true, shares: "1", percent: "80", percentLocked: false },
          ],
        },
      ],
    };

    expect(validateStepThree(sharesInvalid).map((entry) => entry.message)).toEqual(
      expect.arrayContaining(["Total shares must be greater than zero.", "Shares must be zero or more."])
    );
    expect(validateStepThree(percentInvalid).map((entry) => entry.message)).toEqual(
      expect.arrayContaining(["Percent must be zero or more.", "Percent totals must add up to 100."])
    );
    expect(
      rebalancePercentAllocations(
        [
          { participantId: "ana", evenIncluded: true, shares: "1", percent: "20", percentLocked: true },
          { participantId: "bruno", evenIncluded: true, shares: "1", percent: "20", percentLocked: true },
        ],
        "ana",
        "60"
      )
    ).toBeNull();
    expect(rebalancePercentAllocations(percentFixture.initialAllocations, "ana", "-1")).toBeNull();
    expect(
      rebalancePercentAllocations(
        [
          { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: true },
          { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: true },
        ],
        "ana",
        "60"
      )
    ).toBeNull();
  });

  it("covers aggregate helpers and trailing blank removal", () => {
    const values: SplitFormValues = {
      currency: "EUR",
      participants: [
        { id: "ana", name: " Ana  " },
        { id: "bruno", name: "Bruno" },
      ],
      payerParticipantId: "ana",
      items: [
        {
          id: "item-1",
          name: " Milk ",
          price: "-1.00",
          splitMode: "percent",
          allocations: [
            { participantId: "ana", evenIncluded: true, shares: "1", percent: "100", percentLocked: true },
            { participantId: "bruno", evenIncluded: true, shares: "0", percent: "0", percentLocked: false },
          ],
        },
        {
          id: "blank",
          name: "",
          price: "",
          splitMode: "even",
          allocations: [
            { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
            { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
          ],
        },
      ],
    };

    const normalized = removeSingleTrailingBlankItem(values);
    expect(normalized.items).toHaveLength(1);

    const parsed = parseSplit(normalized);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.items[0].shares).toHaveLength(2);
      expect(parsed.data.items[0].shares[0]).toEqual({ participantId: "ana", amountCents: -100 });
      expect(parsed.data.items[0].shares[1]?.participantId).toBe("bruno");
      expect(Object.is(parsed.data.items[0].shares[1]?.amountCents, -0) || parsed.data.items[0].shares[1]?.amountCents === 0).toBe(
        true
      );
      expect(buildShareSummary(parsed.data.items[0], parsed.data.participants, "EUR", "en-US")).toContain("Ana");
    }
  });

  it("covers blank decimal parsing and validation length limits", () => {
    expect(
      validateStepThree({
        currency: "EUR",
        participants: [
          { id: "ana", name: "Ana" },
          { id: "bruno", name: "Bruno" },
        ],
        payerParticipantId: "ana",
        items: [
          {
            id: "shares-empty",
            name: "Bread",
            price: "1.00",
            splitMode: "shares",
            allocations: [
              { participantId: "ana", evenIncluded: true, shares: "", percent: "50", percentLocked: false },
              { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
            ],
          },
          {
            id: "percent-empty",
            name: "Juice",
            price: "1.00",
            splitMode: "percent",
            allocations: [
              { participantId: "ana", evenIncluded: true, shares: "1", percent: "", percentLocked: false },
              { participantId: "bruno", evenIncluded: true, shares: "1", percent: "100", percentLocked: false },
            ],
          },
        ],
      }).map((entry) => entry.message)
    ).toEqual(expect.arrayContaining(["Shares must be zero or more.", "Percent must be zero or more."]));

    expect(
      validateStepOne({
        currency: "EUR",
        participants: [
          { id: "payer", name: "A".repeat(26) },
          { id: "guest", name: "Guest" },
        ],
        payerParticipantId: "payer",
        items: [],
      }).map((entry) => entry.message)
    ).toContain("Keep participant names under 25 characters.");

    expect(
      validateStepTwo({
        currency: "EUR",
        participants: [
          { id: "payer", name: "Payer" },
          { id: "guest", name: "Guest" },
        ],
        payerParticipantId: "payer",
        items: [
          {
            id: "huge",
            name: "X".repeat(33),
            price: "1000001",
            splitMode: "even",
            allocations: [
              { participantId: "payer", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
              { participantId: "guest", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
            ],
          },
        ],
      }).map((entry) => entry.message)
    ).toEqual(expect.arrayContaining(["Keep item names under 32 characters.", "Maximum is 1 000 000"]));
  });

  it("rejects non-finite decimal inputs through the public validation and rebalance APIs", () => {
    expect(
      validateStepThree({
        currency: "EUR",
        participants: [
          { id: "ana", name: "Ana" },
          { id: "bruno", name: "Bruno" },
        ],
        payerParticipantId: "ana",
        items: [
          {
            id: "shares-infinite",
            name: "Bread",
            price: "1.00",
            splitMode: "shares",
            allocations: [
              { participantId: "ana", evenIncluded: true, shares: "1e309", percent: "50", percentLocked: false },
              { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
            ],
          },
        ],
      }).map((entry) => entry.message)
    ).toEqual(expect.arrayContaining(["Shares must be zero or more."]));

    expect(
      rebalancePercentAllocations(
        [
          { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
          { participantId: "bruno", evenIncluded: true, shares: "1", percent: "", percentLocked: true },
          { participantId: "carla", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
        ],
        "ana",
        "1e309"
      )
    ).toBeNull();

    expect(
      rebalancePercentAllocations(
        [
          { participantId: "ana", evenIncluded: true, shares: "1", percent: "40", percentLocked: false },
          { participantId: "bruno", evenIncluded: true, shares: "1", percent: "", percentLocked: true },
          { participantId: "carla", evenIncluded: true, shares: "1", percent: "60", percentLocked: false },
        ],
        "ana",
        "25"
      )
    ).toEqual([
      { participantId: "ana", evenIncluded: true, shares: "1", percent: "25", percentLocked: true },
      { participantId: "bruno", evenIncluded: true, shares: "1", percent: "0", percentLocked: true },
      { participantId: "carla", evenIncluded: true, shares: "1", percent: "75", percentLocked: false },
    ]);
  });

  it("orders non-payer fractional remainders correctly for positive and negative public settlements", () => {
    const baseValues: SplitFormValues = {
      currency: "EUR",
      participants: [
        { id: "payer", name: "Payer" },
        { id: "b", name: "Bea" },
        { id: "c", name: "Carl" },
      ],
      payerParticipantId: "payer",
      items: [],
    };

    const positive = computeSettlement({
      ...baseValues,
      items: [
        {
          id: "positive",
          name: "Snack",
          price: "0.05",
          splitMode: "shares",
          allocations: [
            { participantId: "payer", evenIncluded: true, shares: "0", percent: "0", percentLocked: false },
            { participantId: "b", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
            { participantId: "c", evenIncluded: true, shares: "2", percent: "66.67", percentLocked: false },
          ],
        },
      ],
    });

    expect(positive).toEqual({
      ok: true,
      data: {
        currency: "EUR",
        itemBreakdown: [
          {
            id: "positive",
            name: "Snack",
            amountCents: 5,
            splitMode: "shares",
            shares: [
              { participantId: "payer", amountCents: 0 },
              { participantId: "b", amountCents: 2 },
              { participantId: "c", amountCents: 3 },
            ],
          },
        ],
        people: [
          { participantId: "payer", name: "Payer", consumedCents: 0, paidCents: 5, netCents: 5, isPayer: true },
          { participantId: "b", name: "Bea", consumedCents: 2, paidCents: 0, netCents: -2, isPayer: false },
          { participantId: "c", name: "Carl", consumedCents: 3, paidCents: 0, netCents: -3, isPayer: false },
        ],
        transfers: [
          { fromParticipantId: "b", fromName: "Bea", toParticipantId: "payer", toName: "Payer", amountCents: 2 },
          { fromParticipantId: "c", fromName: "Carl", toParticipantId: "payer", toName: "Payer", amountCents: 3 },
        ],
        totalCents: 5,
      },
    });

    const negative = computeSettlement({
      ...baseValues,
      items: [
        {
          id: "negative",
          name: "Discount",
          price: "-0.05",
          splitMode: "shares",
          allocations: [
            { participantId: "payer", evenIncluded: true, shares: "0", percent: "0", percentLocked: false },
            { participantId: "b", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
            { participantId: "c", evenIncluded: true, shares: "2", percent: "66.67", percentLocked: false },
          ],
        },
      ],
    });

    expect(negative).toEqual({
      ok: true,
      data: {
        currency: "EUR",
        itemBreakdown: [
          {
            id: "negative",
            name: "Discount",
            amountCents: -5,
            splitMode: "shares",
            shares: [
              expect.objectContaining({ participantId: "payer" }),
              { participantId: "b", amountCents: -2 },
              { participantId: "c", amountCents: -3 },
            ],
          },
        ],
        people: [
          { participantId: "payer", name: "Payer", consumedCents: 0, paidCents: -5, netCents: -5, isPayer: true },
          { participantId: "b", name: "Bea", consumedCents: -2, paidCents: 0, netCents: 2, isPayer: false },
          { participantId: "c", name: "Carl", consumedCents: -3, paidCents: 0, netCents: 3, isPayer: false },
        ],
        transfers: [],
        totalCents: -5,
      },
    });
    if (negative.ok) {
      expect(Object.is(negative.data.itemBreakdown[0]?.shares[0]?.amountCents, -0) || negative.data.itemBreakdown[0]?.shares[0]?.amountCents === 0).toBe(true);
    }
  });

  it("covers excluded even participants and unknown share summaries through public APIs", () => {
    const parsed = parseSplit({
      currency: "EUR",
      participants: [
        { id: "payer", name: "Payer" },
        { id: "guest", name: "Guest" },
      ],
      payerParticipantId: "payer",
      items: [
        {
          id: "item-1",
          name: "Soup",
          price: "4.00",
          splitMode: "even",
          allocations: [
            { participantId: "payer", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
            { participantId: "guest", evenIncluded: false, shares: "1", percent: "50", percentLocked: false },
          ],
        },
      ],
    });

    expect(parsed).toEqual({
      ok: true,
      data: {
        currency: "EUR",
        participants: [
          { id: "payer", name: "Payer", isPayer: true },
          { id: "guest", name: "Guest", isPayer: false },
        ],
        items: [
          {
            id: "item-1",
            name: "Soup",
            amountCents: 400,
            splitMode: "even",
            shares: [
              { participantId: "payer", amountCents: 400 },
              { participantId: "guest", amountCents: 0 },
            ],
          },
        ],
      },
    });

    expect(
      buildShareSummary(
        {
          id: "item-2",
          name: "Mystery",
          amountCents: 100,
          splitMode: "even",
          shares: [{ participantId: "ghost", amountCents: 100 }],
        },
        [{ id: "payer", name: "Payer", isPayer: true }],
        "EUR"
      )
    ).toContain("Unknown");
  });
});
