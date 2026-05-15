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

import pdfFixture from "../../docs/logic/fixtures/pdf-export-mixed-modes.json";
import * as Print from "expo-print";
import { Asset } from "expo-asset";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { Platform } from "react-native";

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

  it("uses legacy file-system reads for header image when base64Sync fails", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
    const shareAsync = Sharing.shareAsync as jest.Mock;
    const fromModule = Asset.fromModule as unknown as jest.Mock;
    const base64SyncSpy = jest
      .spyOn((File as any).prototype, "base64Sync")
      .mockImplementationOnce(() => {
        throw new Error("URI is not absolute");
      });

    fromModule.mockReturnValueOnce({
      localUri: "/data/user/0/com.miagology.splitbill/files/split-bill-pdf-header.png",
      downloadAsync: jest.fn().mockResolvedValue(undefined),
    });
    mockLegacyReadAsStringAsync.mockResolvedValue("LEGACY_BASE64_HEADER");
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

    expect(mockLegacyReadAsStringAsync).toHaveBeenCalledWith(
      "file:///data/user/0/com.miagology.splitbill/files/split-bill-pdf-header.png",
      { encoding: "base64" },
    );
    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("data:image/png;base64,LEGACY_BASE64_HEADER"),
      }),
    );
    base64SyncSpy.mockRestore();
  });

  it("falls back to local header image URI on Android when base64 loading fails", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
    const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
    const shareAsync = Sharing.shareAsync as jest.Mock;
    const fromModule = Asset.fromModule as unknown as jest.Mock;
    const platformOsDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");
    const base64SyncSpy = jest
      .spyOn((File as any).prototype, "base64Sync")
      .mockImplementationOnce(() => {
        throw new Error("base64 conversion failed");
      });

    try {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });
      fromModule.mockReturnValueOnce({
        localUri: "/data/user/0/com.miagology.splitbill/files/split-bill-pdf-header.png",
        downloadAsync: jest.fn().mockResolvedValue(undefined),
      });
      mockLegacyReadAsStringAsync.mockRejectedValueOnce(
        new Error("legacy read failed"),
      );
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
          html: expect.stringContaining(
            "src=\"file:///data/user/0/com.miagology.splitbill/files/split-bill-pdf-header.png\"",
          ),
        }),
      );
    } finally {
      if (platformOsDescriptor) {
        Object.defineProperty(Platform, "OS", platformOsDescriptor);
      } else {
        Object.defineProperty(Platform, "OS", {
          configurable: true,
          value: "ios",
        });
      }
      base64SyncSpy.mockRestore();
    }
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

  it("fails when header loading fails and fallback is explicitly disabled", async () => {
    const printToFileAsync = Print.printToFileAsync as jest.Mock;
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

    await expect(
      buildSettlementPdfFile(
        {
          ...(pdfFixture.input as SplitFormValues),
          splitName: "Grocery bill",
        },
        pdfFixture.assumptions.locale,
        { allowHeaderlessWhenAssetUnavailable: false },
      ),
    ).rejects.toThrow("Failed to load PDF header image asset.");

    expect(printToFileAsync).not.toHaveBeenCalled();
  });
});
