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
  });

  it("covers singular ignored-line warnings and malformed name/price variants", () => {
    expect(parsePastedItems("- 1.20")).toEqual({
      items: [],
      ignoredLines: ["- 1.20"],
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
  });
});
