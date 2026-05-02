jest.mock("expo-print", () => ({
  printToFileAsync: jest.fn(),
}));

const mockCopy = jest.fn();
const mockMove = jest.fn();
const mockDelete = jest.fn();
const mockExistingUris = new Set<string>();

jest.mock("expo-file-system", () => ({
  Paths: {
    document: { uri: "file:///docs/" },
  },
  File: class MockFile {
    uri: string;

    constructor(...segments: Array<{ uri?: string } | string>) {
      const normalized = segments.map((segment) =>
        typeof segment === "string" ? segment : (segment.uri ?? "")
      );
      const [firstSegment, ...rest] = normalized;
      const normalizedFirstSegment = firstSegment.replace(/\/+$/, "");
      const trimmedRest = rest.map((segment) => segment.replace(/^\/+/, ""));
      this.uri = [normalizedFirstSegment, ...trimmedRest].join("/");
    }

    get exists() {
      return mockExistingUris.has(this.uri);
    }

    delete() {
      mockDelete(this.uri);
      mockExistingUris.delete(this.uri);
    }

    copy(destination: { uri: string }) {
      mockCopy(this.uri, destination.uri);
      mockExistingUris.add(destination.uri);
    }

    move(destination: { uri: string }) {
      mockMove(this.uri, destination.uri);
      mockExistingUris.delete(this.uri);
      mockExistingUris.add(destination.uri);
    }

    base64Sync() {
      return "mockBase64HeaderImage";
    }
  },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      localUri: "file:///assets/split-bill-pdf-header.png",
      downloadAsync: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

import pdfFixture from "../../docs/logic/fixtures/pdf-export-mixed-modes.json";
import * as Print from "expo-print";
import { Asset } from "expo-asset";
import * as Sharing from "expo-sharing";

import {
  buildSettlementPdfFile,
  renderSettlementPdfHtml,
  exportSettlementPdf,
} from "./exportSettlementPdf";
import type { SplitFormValues } from "../domain";

describe("mobile PDF export", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistingUris.clear();
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
      {
        ...(pdfFixture.expected as any),
        appName: "Split Bill",
        splitName: "Grocery bill",
        splitTitle: "Grocery bill split summary",
      },
      pdfFixture.assumptions.locale,
      "data:image/png;base64,mockBase64HeaderImage",
    );

    expect(html).toContain("Grocery bill");
    expect(html).toContain("(Mar 9, 2026)");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("Total receipt");
    expect(html).toContain("€12.00");
    expect(html).toContain("Participants");
    expect(html).toContain(">2<");
    expect(html).toContain("Items");
    expect(html).toContain(">3<");
    expect(html).toContain("data:image/png;base64,mockBase64HeaderImage");
    expect(html).toContain("Final settlement");
    expect(html).toContain("Who owes");
    expect(html).toContain("Item breakdown");
    expect(html).toContain("Person breakdown");
    expect(html).toContain(
      "Item breakdown is provisional. Final leftover cents are balanced in the final balances section.",
    );
    expect(
      html.match(/Item breakdown is provisional\. Final leftover cents are balanced in the final balances section\./g)
        ?.length
    ).toBe(1);
    expect(html).toContain("Paid €12.00 - Collect €7.00");
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

    expect(html.indexOf("Person breakdown")).toBeLessThan(
      html.indexOf("Item breakdown"),
    );
  });

  it("renders FX metadata bubbles when exchange rate is provided", () => {
    const html = renderSettlementPdfHtml(
      {
        ...(pdfFixture.expected as any),
        exchangeRate: {
          sourceCurrency: "USD",
          targetCurrency: "EUR",
          rate: 0.92,
        },
      },
      pdfFixture.assumptions.locale,
    );

    expect(html).toContain("Original currency");
    expect(html).toContain("Target currency");
    expect(html).toContain("Rate used");
    expect(html).toContain("1 USD = 0.92 EUR");
  });

  it("exports a generated PDF and opens the native share flow", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
    const shareAsync = Sharing.shareAsync as jest.Mock;

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    isAvailableAsync.mockResolvedValue(true);
    shareAsync.mockResolvedValue(undefined);

    await exportSettlementPdf(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Grocery bill",
      },
      pdfFixture.assumptions.locale,
    );

    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Final settlement"),
        base64: false,
      }),
    );
    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("data:image/png;base64,mockBase64HeaderImage"),
      }),
    );
    expect(mockCopy).toHaveBeenCalledWith(
      "file:///tmp/split-bill.pdf",
      expect.stringContaining(
        "file:///docs/grocery-bill-2026-03-09.pdf.tmp-",
      ),
    );
    expect(mockMove).toHaveBeenCalledWith(
      expect.stringContaining(
        "file:///docs/grocery-bill-2026-03-09.pdf.tmp-",
      ),
      "file:///docs/grocery-bill-2026-03-09.pdf",
    );
    expect(mockDelete).toHaveBeenCalledWith("file:///tmp/split-bill.pdf");
    expect(shareAsync).toHaveBeenCalledWith("file:///docs/grocery-bill-2026-03-09.pdf", {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "grocery-bill-2026-03-09.pdf",
    });
  });

  it("builds a generated PDF file without opening the native share flow", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const shareAsync = Sharing.shareAsync as jest.Mock;

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");

    const result = await buildSettlementPdfFile(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Grocery bill",
      },
      pdfFixture.assumptions.locale,
    );

    expect(result).toEqual({
      uri: "file:///docs/grocery-bill-2026-03-09.pdf",
      fileName: "grocery-bill-2026-03-09.pdf",
    });
    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Final settlement"),
        base64: false,
      }),
    );
    expect(mockCopy).toHaveBeenCalledWith(
      "file:///tmp/split-bill.pdf",
      expect.stringContaining(
        "file:///docs/grocery-bill-2026-03-09.pdf.tmp-",
      ),
    );
    expect(mockMove).toHaveBeenCalledWith(
      expect.stringContaining(
        "file:///docs/grocery-bill-2026-03-09.pdf.tmp-",
      ),
      "file:///docs/grocery-bill-2026-03-09.pdf",
    );
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it("replaces an existing named PDF before sharing again", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
    const shareAsync = Sharing.shareAsync as jest.Mock;

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    isAvailableAsync.mockResolvedValue(true);
    shareAsync.mockResolvedValue(undefined);

    await exportSettlementPdf(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Grocery bill",
      },
      pdfFixture.assumptions.locale,
    );
    mockExistingUris.add("file:///tmp/split-bill.pdf");

    await exportSettlementPdf(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Grocery bill",
      },
      pdfFixture.assumptions.locale,
    );

    expect(mockDelete).toHaveBeenCalledWith("file:///docs/grocery-bill-2026-03-09.pdf");
    expect(mockDelete).toHaveBeenCalledWith("file:///tmp/split-bill.pdf");
    expect(mockCopy).toHaveBeenNthCalledWith(
      2,
      "file:///tmp/split-bill.pdf",
      expect.stringContaining(
        "file:///docs/grocery-bill-2026-03-09.pdf.tmp-",
      ),
    );
    expect(shareAsync).toHaveBeenLastCalledWith(
      "file:///docs/grocery-bill-2026-03-09.pdf",
      {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "grocery-bill-2026-03-09.pdf",
      },
    );
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

  it("falls back to exporting without a branded header when image loading fails", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
    const shareAsync = Sharing.shareAsync as jest.Mock;
    const fromModule = Asset.fromModule as unknown as jest.Mock;

    fromModule.mockReturnValueOnce({
      localUri: null,
      downloadAsync: jest.fn().mockRejectedValueOnce(new Error("asset down")),
    });
    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    isAvailableAsync.mockResolvedValue(true);
    shareAsync.mockResolvedValue(undefined);

    await exportSettlementPdf(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Grocery bill",
      },
      pdfFixture.assumptions.locale,
    );

    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.not.stringContaining("data:image/png;base64,"),
      }),
    );
  });
});
