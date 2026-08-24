import pasteFixture from "../../docs/logic/fixtures/paste-parse-basic.json";

import { parsePastedItems } from "./pasteImport";

describe("paste import parser", () => {
  it("matches the golden pasted-list fixture", () => {
    expect(parsePastedItems(pasteFixture.input)).toEqual(pasteFixture.expected);
  });

  it("warns when lines are malformed or summary-like", () => {
    const result = parsePastedItems("item,price\nTotal 12.00\nBroken Line");

    expect(result.items).toEqual([]);
    expect(result.ignoredLines).toEqual(["item,price", "Total 12.00", "Broken Line"]);
    expect(result.ignoredLineDetails).toEqual([
      { line: "item,price", reason: "Header row" },
      { line: "Total 12.00", reason: "Looks like a total or payment summary" },
      { line: "Broken Line", reason: "Missing item price" },
    ]);
    expect(result.lineDetails).toEqual([
      { kind: "ignored", line: "item,price", reason: "Header row" },
      { kind: "ignored", line: "Total 12.00", reason: "Looks like a total or payment summary" },
      { kind: "ignored", line: "Broken Line", reason: "Missing item price" },
    ]);
    expect(result.warnings).toEqual([
      {
        code: "ignored-paste-lines",
        message: "Ignored 3 pasted lines that did not match the expected format.",
      },
      {
        code: "no-items-detected",
        message: "No valid items were detected. Use lines like `Bananas - 2.49`, `Bananas 2.49`, or `item,price`.",
      },
    ]);
  });

  it("parses csv and trailing price variations", () => {
    const result = parsePastedItems("Bananas,2.49\nMilk $3.40\n1) Bread - 1.20");

    expect(result.items).toEqual([
      { name: "Bananas", price: "2.49" },
      { name: "Milk", price: "3.40" },
      { name: "Bread", price: "1.20" },
    ]);
  });

  it("ignores plain-text code fence lines around AI output", () => {
    const result = parsePastedItems("```text\nBananas - 2.49\nMilk 3.40\n```");

    expect(result.items).toEqual([
      { name: "Bananas", price: "2.49" },
      { name: "Milk", price: "3.40" },
    ]);
    expect(result.ignoredLines).toEqual([]);
    expect(result.ignoredLineDetails).toEqual([]);
    expect(result.lineDetails).toEqual([
      { kind: "item", line: "Bananas - 2.49", item: { name: "Bananas", price: "2.49" } },
      { kind: "item", line: "Milk 3.40", item: { name: "Milk", price: "3.40" } },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("preserves original non-blank line order across accepted and ignored rows", () => {
    const result = parsePastedItems("\nBananas - 2.49\nTotal 2.49\n\nMilk 3.40\nBroken Line");

    expect(result.items).toEqual([
      { name: "Bananas", price: "2.49" },
      { name: "Milk", price: "3.40" },
    ]);
    expect(result.ignoredLineDetails).toEqual([
      { line: "Total 2.49", reason: "Looks like a total or payment summary" },
      { line: "Broken Line", reason: "Missing item price" },
    ]);
    expect(result.lineDetails).toEqual([
      { kind: "item", line: "Bananas - 2.49", item: { name: "Bananas", price: "2.49" } },
      { kind: "ignored", line: "Total 2.49", reason: "Looks like a total or payment summary" },
      { kind: "item", line: "Milk 3.40", item: { name: "Milk", price: "3.40" } },
      { kind: "ignored", line: "Broken Line", reason: "Missing item price" },
    ]);
  });

  it("covers normalization edge cases and summary-label rejection rules", () => {
    const result = parsePastedItems([
      "",
      "1) Grapes: 1.234,56",
      "Rice - EUR",
      `Huge - 1${"0".repeat(400)}`,
      "Tea,abc",
      "   ",
      "Card 4.00",
      "Name,Amount",
      "* Water - ",
      "Bread - EUR 2,40",
    ].join("\n"));

    expect(result.items).toEqual([
      { name: "Grapes", price: "1234.56" },
      { name: "Bread", price: "2.40" },
    ]);
    expect(result.ignoredLines).toEqual(
      expect.arrayContaining([`Huge - 1${"0".repeat(400)}`, "Rice - EUR", "Tea,abc", "Card 4.00", "Name,Amount", "* Water -"])
    );
    expect(result.ignoredLineDetails).toEqual(
      expect.arrayContaining([
        { line: "Rice - EUR", reason: "Price is missing or invalid" },
        { line: "Card 4.00", reason: "Looks like a total or payment summary" },
        { line: "Name,Amount", reason: "Header row" },
        { line: "* Water -", reason: "Missing item price" },
      ])
    );
  });

  it("covers singular ignored-line warnings and malformed name/price variants", () => {
    expect(parsePastedItems("- 1.20")).toEqual({
      items: [],
      ignoredLines: ["- 1.20"],
      ignoredLineDetails: [
        { line: "- 1.20", reason: "Use one item per line with a name and price" },
      ],
      lineDetails: [
        { kind: "ignored", line: "- 1.20", reason: "Use one item per line with a name and price" },
      ],
      warnings: [
        {
          code: "ignored-paste-lines",
          message: "Ignored 1 pasted line that did not match the expected format.",
        },
        {
          code: "no-items-detected",
          message: "No valid items were detected. Use lines like `Bananas - 2.49`, `Bananas 2.49`, or `item,price`.",
        },
      ],
    });

    const trailingMalformed = parsePastedItems("Milk EUR");
    expect(trailingMalformed.items).toEqual([]);
    expect(trailingMalformed.ignoredLines).toEqual(["Milk EUR"]);
    expect(trailingMalformed.ignoredLineDetails).toEqual([
      { line: "Milk EUR", reason: "Missing item price" },
    ]);
  });

  it("distinguishes missing price from invalid price in line preview reasons", () => {
    const result = parsePastedItems("I2\nI2 x\nMilk,\n,2.00");

    expect(result.items).toEqual([]);
    expect(result.ignoredLineDetails).toEqual([
      { line: "I2", reason: "Missing item price" },
      { line: "I2 x", reason: "Price is missing or invalid" },
      { line: "Milk,", reason: "Missing item price" },
      { line: ",2.00", reason: "Missing item name" },
    ]);
  });

  it("skips imported items whose names exceed the AI handover margin", () => {
    const validName = "A".repeat(64);
    const longName = "B".repeat(65);
    const result = parsePastedItems(`${validName} - 1.00\n${longName} - 2.00`);

    expect(result.items).toEqual([{ name: validName, price: "1.00" }]);
    expect(result.ignoredLines).toEqual([`${longName} - 2.00`]);
    expect(result.ignoredLineDetails).toEqual([
      {
        line: `${longName} - 2.00`,
        reason: "Item name is longer than 64 characters",
      },
    ]);
  });

  it("rejects summary labels for colon and hyphen rows too", () => {
    expect(parsePastedItems("Total: 42.00\nSubtotal - 20.00")).toEqual({
      items: [],
      ignoredLines: ["Total: 42.00", "Subtotal - 20.00"],
      ignoredLineDetails: [
        { line: "Total: 42.00", reason: "Looks like a total or payment summary" },
        { line: "Subtotal - 20.00", reason: "Looks like a total or payment summary" },
      ],
      lineDetails: [
        { kind: "ignored", line: "Total: 42.00", reason: "Looks like a total or payment summary" },
        { kind: "ignored", line: "Subtotal - 20.00", reason: "Looks like a total or payment summary" },
      ],
      warnings: [
        {
          code: "ignored-paste-lines",
          message: "Ignored 2 pasted lines that did not match the expected format.",
        },
        {
          code: "no-items-detected",
          message: "No valid items were detected. Use lines like `Bananas - 2.49`, `Bananas 2.49`, or `item,price`.",
        },
      ],
    });
  });
});
