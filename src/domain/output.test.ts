import clipboardFixture from "../../docs/logic/fixtures/clipboard-summary-basic.json";
import pdfFixture from "../../docs/logic/fixtures/pdf-export-mixed-modes.json";

import { buildClipboardSummary } from "./output";
import { buildPdfExportData, buildPdfFilename } from "./pdfExport";
import type { SplitFormValues } from "./splitter";

describe("output contracts", () => {
  it("matches the clipboard summary contract", () => {
    expect(buildClipboardSummary(clipboardFixture.input as SplitFormValues, clipboardFixture.assumptions.locale)).toBe(
      clipboardFixture.expectedText
    );
  });

  it("matches the pdf export payload fixture", () => {
    expect(
      buildPdfExportData(
        pdfFixture.input as SplitFormValues,
        new Date(pdfFixture.assumptions.date),
        pdfFixture.assumptions.locale
      )
    ).toEqual({
      ...pdfFixture.expected,
      appName: "Split Bill",
      splitTitle: "Split Bill summary",
    });
  });

  it("returns null summary when settlement is invalid", () => {
    expect(
      buildClipboardSummary(
        {
          currency: "EUR",
          participants: [{ id: "ana", name: "Ana" }],
          payerParticipantId: "",
          items: [],
        },
        "en-US"
      )
    ).toBeNull();
  });

  it("omits settled participants from the shared summary and reduces the payer remaining amount", () => {
    expect(
      buildClipboardSummary(
        {
          currency: "EUR",
          payerParticipantId: "ana",
          participants: [
            { id: "ana", name: "Ana" },
            { id: "bruno", name: "Bruno" },
            { id: "carla", name: "Carla" },
          ],
          items: [
            {
              id: "item-1",
              name: "Dinner",
              price: "18.00",
              splitMode: "even",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "33.34", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
                { participantId: "carla", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
              ],
            },
          ],
        },
        "en-US",
        { settledParticipantIds: ["bruno"] }
      )
    ).toBe("Split Bill\nAna: paid €18.00 and should get back €6.00.\nCarla: owes €6.00.");
  });


  it("sorts the payer first and then the remaining people alphabetically with the default locale", () => {
    expect(
      buildClipboardSummary({
        currency: "EUR",
        payerParticipantId: "zed",
        participants: [
          { id: "zed", name: "Zed" },
          { id: "bob", name: "Bob" },
          { id: "ada", name: "Ada" },
        ],
        items: [
          {
            id: "item-1",
            name: "Fruit",
            price: "9.00",
            splitMode: "even",
            allocations: [
              { participantId: "zed", evenIncluded: true, shares: "1", percent: "33.34", percentLocked: false },
              { participantId: "bob", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
              { participantId: "ada", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
            ],
          },
        ],
      })
    ).toBe(
      "Split Bill\nZed: paid €9.00 and should get back €6.00.\nAda: owes €3.00.\nBob: owes €3.00."
    );
  });

  it("throws when pdf export is requested for an invalid split", () => {
    expect(() =>
      buildPdfExportData(
        {
          currency: "EUR",
          participants: [],
          payerParticipantId: "",
          items: [],
        },
        new Date("2026-03-09T12:00:00.000Z"),
        "en-US"
      )
    ).toThrow("Cannot export PDF for an invalid split.");
  });

  it("sorts exported people with the payer first and the rest alphabetically", () => {
    const data = buildPdfExportData(
      {
        currency: "EUR",
        payerParticipantId: "zed",
        participants: [
          { id: "zed", name: "Zed" },
          { id: "bob", name: "Bob" },
          { id: "ada", name: "Ada" },
        ],
        items: [
          {
            id: "item-1",
            name: "Fruit",
            price: "9.00",
            splitMode: "even",
            allocations: [
              { participantId: "zed", evenIncluded: true, shares: "1", percent: "33.34", percentLocked: false },
              { participantId: "bob", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
              { participantId: "ada", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
            ],
          },
        ],
      },
      new Date("2026-03-10T12:00:00.000Z"),
      "en-US"
    );

    expect(data.people.map((person) => person.name)).toEqual(["Zed", "Ada", "Bob"]);
  });

  it("builds padded filenames, localized dates, and unknown share names through the public export contract", () => {
    const data = buildPdfExportData(
      {
        currency: "EUR",
        payerParticipantId: "payer",
        participants: [
          { id: "payer", name: "alex" },
          { id: "guest", name: "Bea" },
        ],
        items: [
          {
            id: "item-1",
            name: "Discount",
            price: "-1.00",
            splitMode: "percent",
            allocations: [
              { participantId: "payer", evenIncluded: true, shares: "0", percent: "0", percentLocked: false },
              { participantId: "ghost", evenIncluded: true, shares: "1", percent: "100", percentLocked: false },
            ],
          },
        ],
      },
      new Date("2026-01-02T12:00:00.000Z"),
      "en-US"
    );

    expect(buildPdfFilename(undefined, new Date("2026-01-02T12:00:00.000Z"))).toBe("split-bill-2026-01-02.pdf");
    expect(data.exportDateLabel).toBe("Jan 2, 2026");
    expect(data.fileName).toBe("split-bill-2026-01-02.pdf");
    expect(data.appName).toBe("Split Bill");
    expect(data.splitTitle).toBe("Split Bill summary");
    expect(data.people.map((person) => person.name)).toEqual(["alex", "Bea"]);
    expect(data.items[0]?.splitModeLabel).toBe("Percent");
    expect(data.items[0]?.shares).toEqual([
      {
        participantId: "ghost",
        name: "Unknown",
        amountCents: -100,
      },
    ]);
  });

  it("covers default PDF export arguments and payer-first sorting through the public API", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-03T12:00:00.000Z"));

    try {
      const data = buildPdfExportData({
        currency: "EUR",
        payerParticipantId: "payer",
        participants: [
          { id: "guest-b", name: "Bob" },
          { id: "payer", name: "Payer" },
          { id: "guest-a", name: "Ada" },
        ],
        items: [
          {
            id: "item-1",
            name: "Fruit",
            price: "9.00",
            splitMode: "even",
            allocations: [
              { participantId: "guest-b", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
              { participantId: "payer", evenIncluded: true, shares: "1", percent: "33.34", percentLocked: false },
              { participantId: "guest-a", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
            ],
          },
        ],
      });

      expect(buildPdfFilename()).toBe("split-bill-2026-02-03.pdf");
      expect(data.fileName).toBe("split-bill-2026-02-03.pdf");
      expect(data.exportDateLabel).toBeTruthy();
      expect(data.people.map((person) => person.name)).toEqual(["Payer", "Ada", "Bob"]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("uses the split name for PDF titles and filenames when available", () => {
    const data = buildPdfExportData(
      {
        splitName: "Weekend Groceries",
        currency: "EUR",
        payerParticipantId: "payer",
        participants: [
          { id: "payer", name: "Payer" },
          { id: "guest", name: "Guest" },
        ],
        items: [
          {
            id: "item-1",
            name: "Milk",
            price: "8.00",
            splitMode: "even",
            allocations: [
              { participantId: "payer", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
              { participantId: "guest", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
            ],
          },
        ],
      },
      new Date("2026-05-10T12:00:00.000Z"),
      "en-US",
    );

    expect(buildPdfFilename("Weekend Groceries", new Date("2026-05-10T12:00:00.000Z"))).toBe(
      "weekend-groceries-2026-05-10.pdf",
    );
    expect(data.fileName).toBe("weekend-groceries-2026-05-10.pdf");
    expect(data.splitTitle).toBe("Weekend Groceries split summary");
  });

  it("uses sign-aware clipboard wording for non-payer credits and payer debts", () => {
    expect(
      buildClipboardSummary(
        {
          currency: "EUR",
          payerParticipantId: "payer",
          participants: [
            { id: "payer", name: "Payer" },
            { id: "creditor", name: "Creditor" },
            { id: "debtor", name: "Debtor" },
          ],
          items: [
            {
              id: "discount",
              name: "Discount",
              price: "-1.00",
              splitMode: "even",
              allocations: [
                { participantId: "payer", evenIncluded: false, shares: "0", percent: "0", percentLocked: false },
                { participantId: "creditor", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
                { participantId: "debtor", evenIncluded: false, shares: "0", percent: "50", percentLocked: false },
              ],
            },
          ],
        },
        "en-US"
      )
    ).toBe("Split Bill\nPayer: paid -€1.00 and still owes €1.00.\nCreditor: gets back €1.00.");
  });

  it("reduces payer output to a paid-only line when nobody still owes anything", () => {
    expect(
      buildClipboardSummary(
        {
          currency: "EUR",
          payerParticipantId: "ana",
          participants: [
            { id: "ana", name: "Ana" },
            { id: "bruno", name: "Bruno" },
          ],
          items: [
            {
              id: "item-1",
              name: "Dinner",
              price: "10.00",
              splitMode: "even",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
              ],
            },
          ],
        },
        "en-US",
        { settledParticipantIds: ["bruno"] }
      )
    ).toBe("Split Bill\nAna: paid €10.00.");
  });

  it("uses the split name in the clipboard summary title when available", () => {
    expect(
      buildClipboardSummary(
        {
          splitName: "Weekend groceries",
          currency: "EUR",
          payerParticipantId: "ana",
          participants: [
            { id: "ana", name: "Ana" },
            { id: "bruno", name: "Bruno" },
          ],
          items: [
            {
              id: "item-1",
              name: "Groceries",
              price: "10.00",
              splitMode: "even",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
              ],
            },
          ],
        },
        "en-US",
      ),
    ).toBe("Split Bill - Weekend groceries\nAna: paid €10.00 and should get back €5.00.\nBruno: owes €5.00.");
  });
});
