import { buildPdfExportData } from "../domain/pdfExport";
jest.mock("expo-print", () => ({
  printToFileAsync: jest.fn(),
}));

const mockCopy = jest.fn();
const mockMove = jest.fn();
const mockDelete = jest.fn();
const mockExistingUris = new Set<string>();
const mockExistingDirectoryUris = new Set<string>();
const mockUnreadableDirectoryUris = new Set<string>();
const mockPickDirectoryAsync = jest.fn();
const mockSafDirectoryEntries = new Map<string, string[]>();
const mockSafCreateFileAsync = jest.fn();
const mockLegacyCopyAsync = jest.fn();
const mockLegacyReadAsStringAsync = jest.fn();
const mockLegacyWriteAsStringAsync = jest.fn();

jest.mock("expo-file-system", () => ({
  Paths: {
    document: { uri: "file:///docs/" },
  },
  Directory: class MockDirectory {
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
      return mockExistingDirectoryUris.has(this.uri);
    }

    list() {
      if (!this.exists || mockUnreadableDirectoryUris.has(this.uri)) {
        throw new Error(`Cannot read directory ${this.uri}`);
      }
      return [];
    }

    static pickDirectoryAsync(initialUri?: string) {
      return mockPickDirectoryAsync(initialUri);
    }
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

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///docs/",
  copyAsync: (...args: any[]) => mockLegacyCopyAsync(...args),
  readAsStringAsync: (...args: any[]) => mockLegacyReadAsStringAsync(...args),
  writeAsStringAsync: (...args: any[]) => mockLegacyWriteAsStringAsync(...args),
  EncodingType: {
    Base64: "base64",
  },
  StorageAccessFramework: {
    readDirectoryAsync: jest.fn(async (uri: string) => mockSafDirectoryEntries.get(uri) ?? []),
    createFileAsync: (...args: any[]) => mockSafCreateFileAsync(...args),
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

jest.mock("./pdfHeaderImageDataUri.generated", () => ({
  PDF_HEADER_IMAGE_DATA_URI: "data:image/png;base64,mockBase64HeaderImage",
}));

import pdfFixture from "../../docs/logic/fixtures/pdf-export-mixed-modes.json";
import * as Print from "expo-print";
import { Asset } from "expo-asset";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";

import {
  buildSettlementPdfFile,
  downloadSettlementPdfToDevice,
  renderSettlementPdfHtml,
  exportSettlementPdf,
  isDirectoryPickerCancelledError,
} from "./exportSettlementPdf";
import type { SplitFormValues } from "../domain";

describe("mobile PDF export", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistingUris.clear();
    mockExistingDirectoryUris.clear();
    mockUnreadableDirectoryUris.clear();
    mockPickDirectoryAsync.mockReset();
    mockSafDirectoryEntries.clear();
    mockSafCreateFileAsync.mockReset();
    mockLegacyCopyAsync.mockReset();
    mockLegacyReadAsStringAsync.mockReset();
    mockLegacyWriteAsStringAsync.mockReset();
    mockExistingDirectoryUris.add("file:///docs");
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
    expect(html).toContain("Split date: Mar 9, 2026");
    expect(html).toContain("Exported on Mar 9, 2026");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<div class="summary-total">');
    expect(html).toContain('<span class="summary-label">Total bill</span>');
    expect(html).toContain('<span class="summary-label">Paid by</span>');
    expect(html).toContain('<strong style="font-size:42px">€12.00</strong>');
    expect(html).toContain('<span class="page-section">Overview</span>');
    expect(html).toContain('<span class="page-section">Person breakdown</span>');
    expect(html).toContain('<span class="page-section">Item breakdown</span>');
    expect(html).toContain('<div class="row breakdown-row"><span class="grow">Milk</span>');
    expect(html).toContain('<div class="row breakdown-row"><span class="grow">Ana</span>');
    expect(html).toContain("Participants: 2");
    expect(html).toContain("Items: 3");
    expect(html).toContain("data:image/png;base64,mockBase64HeaderImage");
    expect(html).toContain("Share the moment, not the math");
    expect(html).toContain("Consumption breakdown");
    expect(html).toContain("Person breakdown");
    expect(html).toMatch(/<strong>Ana<\/strong><span class="payer-chip">Payer<\/span>/);
    expect(html).toMatch(/<span>Ana<\/span><span class="payer-chip">Payer<\/span>/);
    expect(html.match(/class="payer-chip"/g)).toHaveLength(2);
    expect(html).toContain("Item breakdown");
    expect(html).toContain("To collect");
    expect(html).toContain("€7.00");
    expect(html).toContain("Milk");
    expect(html).toContain("Cheese");
    expect(html).toContain("Juice");
    expect(html).toContain("Even split");
    expect(html).toContain("2 shares");
    expect(html).toContain("80%");
    expect(html).not.toContain("Item breakdown is provisional");
    expect(html.indexOf("Person breakdown")).toBeLessThan(html.indexOf("Item breakdown"));
  });

  it("reduces the summary total font for large amounts", () => {
    const data = { ...(pdfFixture.expected as any), payer: { ...(pdfFixture.expected as any).payer, paidCents: 123456789012345 } };
    const html = renderSettlementPdfHtml(data, "en-US", null);
    expect(html).toContain('<strong style="font-size:16px">€1,234,567,890,123.45</strong>');
  });

  it("shows the quantity and rounded discount used to calculate item shares", () => {
    const values = structuredClone(pdfFixture.input) as SplitFormValues;
    values.items[0]!.price = "0.05";
    values.items[0]!.quantity = 3;
    values.items[0]!.discount = { type: "percent", value: "10" };
    const data = buildPdfExportData(values);
    const item = data.items[0]!;
    expect(item.subtotalCents).toBe(15);
    expect(item.discount?.amountCents).toBe(2);
    expect(item.amountCents).toBe(13);
    const html = renderSettlementPdfHtml(data, "en-US", null);
    expect(html).toContain("3 × €0.05 = €0.15");
    expect(html).toContain("Discount (10%) = −€0.02");
    expect(html).toContain("Even split · 2 participants");
  });

  it("shows a conversion rounding adjustment in the consumption overview", () => {
    const data = buildPdfExportData(pdfFixture.input as SplitFormValues);
    data.totalCents = 2;
    data.people[0]!.consumedCents = 1;
    data.people[1]!.consumedCents = 1;
    data.exchangeRate = { sourceCurrency: "EUR", targetCurrency: "USD", rate: 0.5 };
    const html = renderSettlementPdfHtml(data, "en-US", null);
    const overview = html.split('<span class="page-section">Person breakdown</span>')[0]!;
    expect(overview).toContain('class="row adjustment"');
    expect(overview).toContain("−$0.01");
  });

  it("paginates long cards, preserves zero amounts, and reconciles rounding", () => {
    const data = buildPdfExportData({
      currency: "EUR",
      payerParticipantId: "a",
      participants: [{ id: "a", name: "Zed" }, { id: "b", name: "Ada" }, { id: "c", name: "Zero" }],
      items: Array.from({ length: 24 }, (_, index) => ({
        id: `item-${index}`, name: `Item ${index}`, price: "0.01", splitMode: "even" as const,
        allocations: [
          { participantId: "a", evenIncluded: true, shares: "1", percent: "50" },
          { participantId: "b", evenIncluded: true, shares: "1", percent: "50" },
          { participantId: "c", evenIncluded: false, shares: "0", percent: "0" },
        ],
      })),
    }, new Date("2026-03-09T12:00:00Z"), "en-US");
    const html = renderSettlementPdfHtml(data, "en-US", "data:image/png;base64,icon", undefined, {
      a: { initials: "Z", background: "#ffffff", foreground: "#000000", photoUri: "data:image/png;base64,photo" },
    });
    expect(html).toMatch(/class="summary-payer">\s*<img class="avatar" src="data:image\/png;base64,photo"[^>]*>\s*<strong>Zed<\/strong>/);
    expect(html).toContain("Zero");
    expect(html).toContain("No consumption recorded");
    expect(html).toContain("Rounding adjustment");
    expect(html).toContain("-€0.12");
    expect(html).toContain("+€0.12");
    expect(html).toContain("continued");
    expect(html).toMatch(/Person breakdown · Page 1 of [2-9]/);
    expect(html).toMatch(/Item breakdown · Page 1 of [2-9]/);
    expect((html.match(/class="page"/g) ?? []).length).toBeGreaterThan(3);
    expect((html.match(/class="page-header"/g) ?? []).length).toBe((html.match(/class="page"/g) ?? []).length);
    expect(data.items[0]?.shares).toHaveLength(2);
    expect(data.items[0]?.shares.some((share) => share.amountCents === 0)).toBe(true);
  });

  it("fills the remaining page with whole cards and moves the next whole card to a fresh page", () => {
    const data = buildPdfExportData(pdfFixture.input as SplitFormValues);
    const card = data.personBreakdown[0]!;
    data.personBreakdown = Array.from({ length: 5 }, (_, index) => ({
      ...card,
      name: `Person ${index + 1}`,
      totalAmountCents: 4 * card.items[0]!.amountCents,
      items: Array.from({ length: 4 }, () => card.items[0]!),
    }));

    const html = renderSettlementPdfHtml(data, "en-US", null);
    const personPages = html.split('<div class="page">').filter(
      (page) => page.includes('<span class="page-section">Person breakdown</span>'),
    );
    expect(personPages).toHaveLength(2);
    expect(personPages[0]?.match(/<article class="card">/g)).toHaveLength(4);
    expect(personPages[1]).toContain("Person breakdown · Page 2 of 2");
    expect(personPages[1]?.match(/<article class="card">/g)).toHaveLength(1);
    expect(personPages[1]).toContain("Person 5");
    expect(personPages[1]).not.toContain("continued");
  });

  it("places the embedded invoice on a final attachment page", () => {
    const data = { ...(pdfFixture.expected as any), appName: "Split Bill", splitName: "Dinner", splitDateLabel: "Jan 2, 2026" };
    const html = renderSettlementPdfHtml(data, "en-US", null, "data:image/png;base64,abc123");
    expect(html).toContain("Split date: Jan 2, 2026");
    expect(html).toContain("data:image/png;base64,abc123");
    expect(html).toContain('<span class="page-section">Attachments</span>');
    expect(html.match(/<footer class="footer">Page \d+ of \d+<\/footer>/g)).toEqual([
      '<footer class="footer">Page 1 of 4</footer>',
      '<footer class="footer">Page 2 of 4</footer>',
      '<footer class="footer">Page 3 of 4</footer>',
      '<footer class="footer">Page 4 of 4</footer>',
    ]);
    expect(html.indexOf("Attachments")).toBeGreaterThan(html.indexOf("Item breakdown"));
    expect(html).toContain("page-break-after:always");
    expect(renderSettlementPdfHtml(data, "en-US", null)).not.toContain("Attachments");
  });

  it("reports a missing invoice instead of printing an incomplete PDF", async () => {
    mockLegacyReadAsStringAsync.mockRejectedValueOnce(new Error("missing"));
    await expect(buildSettlementPdfFile({ ...(pdfFixture.input as any), invoicePhotoUri: "file:///missing.jpg" }, "en-US"))
      .rejects.toMatchObject({ name: "InvoicePhotoReadError", message: expect.stringContaining("Unable to read the invoice photo") });
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
  });

  it("resolves stable invoice paths against the current document directory for PDF export", async () => {
    mockLegacyReadAsStringAsync.mockResolvedValueOnce("aW1hZ2U=");
    (Print.printToFileAsync as jest.Mock).mockResolvedValueOnce({ uri: "file:///docs/split.pdf" });

    await buildSettlementPdfFile(
      { ...(pdfFixture.input as any), invoicePhotoUri: "invoice-photos/receipt.jpg" },
      "en-US",
    );

    expect(mockLegacyReadAsStringAsync).toHaveBeenCalledWith(
      "file:///docs/invoice-photos/receipt.jpg",
      { encoding: "base64" },
    );
    expect(Print.printToFileAsync).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining("data:image/jpeg;base64,aW1hZ2U="),
    }));
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

  it("renders the payer consumed amount from settlement data without clamping it", () => {
    const html = renderSettlementPdfHtml(
      {
        ...(pdfFixture.expected as any),
        people: (pdfFixture.expected as any).people.map((person: any) => person.isPayer ? { ...person, consumedCents: -100 } : person),
        payer: {
          ...(pdfFixture.expected as any).payer,
          paidCents: 0,
          netCents: 100,
          consumedCents: -100,
        },
      },
      pdfFixture.assumptions.locale,
    );

    expect(html).toContain(
      `${new Intl.NumberFormat(pdfFixture.assumptions.locale, {
        style: "currency",
        currency: (pdfFixture.expected as any).currency,
      }).format(-1)}`,
    );
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
        html: expect.stringContaining("Consumption breakdown"),
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
        html: expect.stringContaining("Consumption breakdown"),
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

  it("downloads a generated PDF into a picked visible directory", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const onDirectoryPicked = jest.fn();

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    mockExistingDirectoryUris.add("file:///downloads");
    mockPickDirectoryAsync.mockResolvedValue({ uri: "file:///downloads" });

    const result = await downloadSettlementPdfToDevice(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Grocery bill",
      },
      pdfFixture.assumptions.locale,
      {
        onDirectoryPicked,
      },
    );

    expect(mockPickDirectoryAsync).toHaveBeenCalled();
    expect(mockCopy).toHaveBeenLastCalledWith(
      "file:///docs/grocery-bill-2026-03-09.pdf",
      "file:///downloads/grocery-bill-2026-03-09.pdf",
    );
    expect(result).toEqual({
      uri: "file:///downloads/grocery-bill-2026-03-09.pdf",
      fileName: "grocery-bill-2026-03-09.pdf",
      directoryUri: "file:///downloads",
    });
    expect(onDirectoryPicked).toHaveBeenCalledWith("file:///downloads");
  });

  it("reuses the remembered visible directory without opening picker", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const onDirectoryPicked = jest.fn();

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    mockExistingDirectoryUris.add("file:///downloads");

    const result = await downloadSettlementPdfToDevice(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Grocery bill",
      },
      pdfFixture.assumptions.locale,
      {
        preferredDirectoryUri: "file:///downloads",
        onDirectoryPicked,
      },
    );

    expect(mockPickDirectoryAsync).not.toHaveBeenCalled();
    expect(result.directoryUri).toBe("file:///downloads");
    expect(onDirectoryPicked).toHaveBeenCalledWith("file:///downloads");
  });

  it("falls back to picker when remembered directory cannot be read", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    mockExistingDirectoryUris.add("file:///downloads");
    mockUnreadableDirectoryUris.add("file:///downloads");
    mockExistingDirectoryUris.add("file:///documents");
    mockPickDirectoryAsync.mockResolvedValue({ uri: "file:///documents" });

    const result = await downloadSettlementPdfToDevice(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Grocery bill",
      },
      pdfFixture.assumptions.locale,
      {
        preferredDirectoryUri: "file:///downloads",
      },
    );

    expect(mockPickDirectoryAsync).toHaveBeenCalledWith("file:///downloads");
    expect(result.directoryUri).toBe("file:///documents");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("saves duplicate download names with suffixes", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    mockExistingDirectoryUris.add("file:///downloads");
    mockExistingUris.add("file:///downloads/grocery-bill-2026-03-09.pdf");
    mockPickDirectoryAsync.mockResolvedValue({ uri: "file:///downloads" });

    const result = await downloadSettlementPdfToDevice(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Grocery bill",
      },
      pdfFixture.assumptions.locale,
    );

    expect(result.fileName).toBe("grocery-bill-2026-03-09 (1).pdf");
    expect(result.uri).toBe("file:///downloads/grocery-bill-2026-03-09 (1).pdf");
  });

  it("throws a typed cancellation error when directory picker is cancelled", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    mockPickDirectoryAsync.mockRejectedValue(new Error("Picker cancelled"));

    let thrownError: unknown;
    try {
      await downloadSettlementPdfToDevice(
        {
          ...(pdfFixture.input as SplitFormValues),
          splitName: "Grocery bill",
        },
        pdfFixture.assumptions.locale,
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toMatchObject({
      name: "DirectoryPickerCancelledError",
    });
    expect(isDirectoryPickerCancelledError(thrownError)).toBe(true);

    expect(
      isDirectoryPickerCancelledError(new Error("noop")),
    ).toBe(false);
  });

  it("treats empty picker result as cancellation", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    mockPickDirectoryAsync.mockResolvedValue(undefined);

    await expect(
      downloadSettlementPdfToDevice(
        {
          ...(pdfFixture.input as SplitFormValues),
          splitName: "Grocery bill",
        },
        pdfFixture.assumptions.locale,
      ),
    ).rejects.toMatchObject({
      name: "DirectoryPickerCancelledError",
    });
  });

  it("does not fail download when persisting picked directory fails", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const onDirectoryPicked = jest.fn(async () => {
      throw new Error("db locked");
    });

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    mockExistingDirectoryUris.add("file:///downloads");
    mockPickDirectoryAsync.mockResolvedValue({ uri: "file:///downloads" });

    const result = await downloadSettlementPdfToDevice(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Grocery bill",
      },
      pdfFixture.assumptions.locale,
      { onDirectoryPicked },
    );

    expect(result.uri).toBe("file:///downloads/grocery-bill-2026-03-09.pdf");
    expect(onDirectoryPicked).toHaveBeenCalledWith("file:///downloads");
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to persist selected PDF folder URI",
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it("downloads into SAF tree directories via StorageAccessFramework", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const safTreeUri =
      "content://com.android.externalstorage.documents/tree/primary%3ATest";
    const existingSafEntry =
      "content://com.android.externalstorage.documents/tree/primary%3ATest/document/primary%3ATest%2Fsplit-bill-2026-03-09.pdf";
    const createdSafFileUri =
      "content://com.android.externalstorage.documents/tree/primary%3ATest/document/primary%3ATest%2Fsplit-bill-2026-03-09%20(1).pdf";

    printToFileAsync.mockResolvedValue({
      uri: "file:///tmp/split-bill.pdf",
      numberOfPages: 1,
    });
    mockExistingUris.add("file:///tmp/split-bill.pdf");
    mockExistingDirectoryUris.add(safTreeUri);
    mockPickDirectoryAsync.mockResolvedValue({ uri: safTreeUri });
    mockSafDirectoryEntries.set(safTreeUri, [existingSafEntry]);
    mockSafCreateFileAsync.mockResolvedValue(createdSafFileUri);
    mockLegacyReadAsStringAsync.mockResolvedValue("BASE64PDF");
    mockLegacyWriteAsStringAsync.mockResolvedValue(undefined);

    const result = await downloadSettlementPdfToDevice(
      {
        ...(pdfFixture.input as SplitFormValues),
        splitName: "Split bill",
      },
      pdfFixture.assumptions.locale,
    );

    expect(mockSafCreateFileAsync).toHaveBeenCalledWith(
      safTreeUri,
      "split-bill-2026-03-09 (1)",
      "application/pdf",
    );
    expect(mockLegacyReadAsStringAsync).toHaveBeenCalledWith(
      "file:///docs/split-bill-2026-03-09.pdf",
      { encoding: "base64" },
    );
    expect(mockLegacyWriteAsStringAsync).toHaveBeenCalledWith(
      createdSafFileUri,
      "BASE64PDF",
      {
        encoding: "base64",
      },
    );
    expect(mockLegacyCopyAsync).not.toHaveBeenCalledWith({
      from: "file:///docs/split-bill-2026-03-09.pdf",
      to: createdSafFileUri,
    });
    expect(result).toEqual({
      uri: createdSafFileUri,
      fileName: "split-bill-2026-03-09 (1).pdf",
      directoryUri: safTreeUri,
    });
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

    expect(mockDelete).toHaveBeenCalledWith(
      "file:///docs/grocery-bill-2026-03-09.pdf",
    );
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

  it("uses the generated PDF header data URI without reading runtime assets", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
    const shareAsync = Sharing.shareAsync as jest.Mock;
    const fromModule = Asset.fromModule as unknown as jest.Mock;
    const base64SyncSpy = jest.spyOn((File as any).prototype, "base64Sync");

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

    expect(fromModule).not.toHaveBeenCalled();
    expect(mockLegacyReadAsStringAsync).not.toHaveBeenCalled();
    expect(base64SyncSpy).not.toHaveBeenCalled();
    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("data:image/png;base64,mockBase64HeaderImage"),
      }),
    );
    base64SyncSpy.mockRestore();
  });

  it("falls back to the app name in the same brand banner when the header data URI is empty", () => {
    const html = renderSettlementPdfHtml(
      {
        ...(pdfFixture.expected as any),
        appName: "Split Bill",
      },
      pdfFixture.assumptions.locale,
      "",
    );

    expect(html).not.toContain("data:image/png;base64,");
    expect(html).toContain("page-header");
    expect(html).toContain("Split Bill");
    expect(html).toContain("Share the moment, not the math");
  });

  it("skips only the branded header area when image and app-name fallbacks are unavailable", () => {
    const html = renderSettlementPdfHtml(
      {
        ...(pdfFixture.expected as any),
        appName: "   ",
      },
      pdfFixture.assumptions.locale,
      null,
    );

    expect(html).not.toContain("data:image/png;base64,");
    expect(html).not.toContain("Share the moment, not the math");
    expect(html).toContain("Consumption breakdown");
  });
});
