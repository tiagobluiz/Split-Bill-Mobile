import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ResultsSummaryCard } from "./ResultsSummaryCard";

const total = { label: "Total bill", amount: "€404,000.00", detail: "3 people" };
const outstanding = { label: "Still to receive", amount: total.amount, detail: "from 1 person" };
const received = { label: "Already received", amount: "€0.00", detail: "from 0 people" };

function layout(id: string, width: number) {
  fireEvent(screen.getByTestId(`results-summary-${id}`, { includeHiddenElements: true }), "layout", {
    nativeEvent: { layout: { width } },
  });
}

function summaryStyle(id: string) {
  return StyleSheet.flatten(screen.getByTestId(`results-summary-${id}`).props.style);
}

it("shrinks just the amount that exceeds its column", () => {
  render(<ResultsSummaryCard total={total} payment={{
    actionLabel: "Payment actions",
    onOpenActions: jest.fn(),
    outstanding,
    received,
  }} />);

  layout("content", 327);
  layout("measure-outstanding-23", 155);
  layout("measure-outstanding-16", 108);
  layout("measure-received-23", 64);
  layout("measure-received-16", 45);

  expect(summaryStyle("payments").flexDirection).toBe("row");
  expect(summaryStyle("outstanding").fontSize).toBe(22);
  expect(summaryStyle("received").fontSize).toBe(23);
});

it("stacks either oversized payment and preserves the amount at the floor", () => {
  const amount = "€123,456,789,012.34";
  render(<ResultsSummaryCard total={{ ...total, amount }} payment={{
    actionLabel: "Payment actions",
    onOpenActions: jest.fn(),
    outstanding: { ...outstanding, amount: "€0.00" },
    received: { ...received, amount },
  }} />);

  layout("content", 327);
  layout("measure-total-32", 360);
  layout("measure-total-16", 180);
  layout("measure-received-23", 274);
  layout("measure-received-16", 191);

  expect(summaryStyle("payments").flexDirection).toBe("column");
  expect(summaryStyle("received").fontSize).toBe(23);

  layout("content", 180);

  expect(summaryStyle("total").fontSize).toBe(16);
  expect(summaryStyle("received").fontSize).toBe(16);
  const visibleAmount = screen.getByTestId("results-summary-received");
  expect(visibleAmount.props.numberOfLines).toBeUndefined();
  expect(visibleAmount).toHaveTextContent(amount);
});
