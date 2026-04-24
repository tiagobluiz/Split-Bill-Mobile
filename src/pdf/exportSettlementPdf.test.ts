jest.mock("expo-print", () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

import pdfFixture from "../../docs/logic/fixtures/pdf-export-mixed-modes.json";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { renderSettlementPdfHtml, exportSettlementPdf } from "./exportSettlementPdf";
import type { SplitFormValues } from "../domain";

describe("mobile PDF export", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(
      new Date("2026-03-09T12:00:00.000Z"),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders the same PDF sections and content as the web export", () => {
    const html = renderSettlementPdfHtml(
      pdfFixture.expected as any,
      pdfFixture.assumptions.locale,
    );

    expect(html).toContain("Grocery bill split summary");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("Exported Mar 9, 2026");
    expect(html).toContain("Currency EUR");
    expect(html).toContain("Final settlement");
    expect(html).toContain("Who owes");
    expect(html).toContain("Item breakdown");
    expect(html).toContain("Person breakdown");
    expect(html).toContain(
      "Item breakdown is provisional. Final leftover cents are balanced in the final balances section.",
    );
    expect(html).toContain("Paid €12.00 - Collect €7.00");
    expect(html).toContain("Total receipt €12.00");
    expect(html).toContain("Bruno");
    expect(html).toContain("Milk");
    expect(html).toContain("Cheese");
    expect(html).toContain("Juice");
    expect(html).toContain("Ana");
    expect(html).toContain("Even split");
    expect(html).toContain("Share units");
    expect(html).toContain("Percent");
    expect(html).toContain("€2.00");
    expect(html).toContain("€4.00");
  });

  it("exports a generated PDF and opens the native share flow", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
    const shareAsync = Sharing.shareAsync as jest.Mock;

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    isAvailableAsync.mockResolvedValue(true);
    shareAsync.mockResolvedValue(undefined);

    await exportSettlementPdf(
      pdfFixture.input as SplitFormValues,
      pdfFixture.assumptions.locale,
    );

    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Final settlement"),
        base64: false,
      }),
    );
    expect(shareAsync).toHaveBeenCalledWith("file:///tmp/split-bill.pdf", {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "split-bill-2026-03-09.pdf",
    });
  });

  it("throws when the split is invalid", async () => {
    await expect(
      exportSettlementPdf(
        {
          currency: "EUR",
          participants: [],
          payerParticipantId: "",
          items: [],
        },
        "en-US",
      ),
    ).rejects.toThrow("Cannot export PDF for an invalid split.");
  });

  it("fails cleanly when sharing is unavailable", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    isAvailableAsync.mockResolvedValue(false);

    await expect(
      exportSettlementPdf(
        pdfFixture.input as SplitFormValues,
        pdfFixture.assumptions.locale,
      ),
    ).rejects.toThrow("Sharing is not available on this device.");
    expect(printToFileAsync).not.toHaveBeenCalled();
  });

  it("derives the PDF document language from the locale", () => {
    const html = renderSettlementPdfHtml(
      pdfFixture.expected as any,
      "pt-PT",
    );

    expect(html).toContain('<html lang="pt">');
  });

  it("surfaces print errors", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;

    isAvailableAsync.mockResolvedValue(true);
    printToFileAsync.mockRejectedValue(new Error("printer unavailable"));

    await expect(
      exportSettlementPdf(
        pdfFixture.input as SplitFormValues,
        pdfFixture.assumptions.locale,
      ),
    ).rejects.toThrow("printer unavailable");
  });
});
