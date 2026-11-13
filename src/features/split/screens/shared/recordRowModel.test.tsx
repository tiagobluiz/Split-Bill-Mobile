import { fireEvent, render, screen } from "@testing-library/react-native";
import { buildRecordFixture } from "../../integrationTestUtils";
import type { DraftRecord } from "../../../../storage/records";
import { RecordRow } from "./homeParts";
import { createRecordRowModel } from "./recordRowModel";
import { translateWithSettings } from "../../../../i18n";

it("shows a compact split row and opens the correct record and actions", () => {
  const record = buildRecordFixture({ id: "old-split", status: "completed" }) as unknown as DraftRecord;
  record.values.splitName = "Dinner";
  const settings = { defaultCurrency: "EUR", tags: [] };
  const model = createRecordRowModel(record, "Ana", settings);
  const openRecord = jest.fn();
  const openActions = jest.fn();
  render(<RecordRow record={model} ownerName="Ana" settings={settings} onOpenRecord={openRecord} onOpenActions={openActions} />);
  const row = screen.getByLabelText("Open split Dinner");
  expect(screen.getByText("Dinner")).toBeTruthy();
  fireEvent.press(row);
  expect(openRecord).toHaveBeenCalledWith("old-split");
  fireEvent(row, "longPress");
  expect(openActions).toHaveBeenCalledWith({ id: "old-split", title: "Dinner" });
  openActions.mockClear();
  openRecord.mockClear();
  fireEvent.press(screen.getByLabelText("Open actions for split Dinner"));
  expect(openActions).toHaveBeenCalledWith({ id: "old-split", title: "Dinner" });
  expect(openRecord).not.toHaveBeenCalled();
});

it("only shows the amount and its divider for completed splits", () => {
  const settings = { defaultCurrency: "EUR", splitListAmountDisplay: "total" as const, tags: [] };
  const draft = createRecordRowModel(buildRecordFixture({ status: "draft" }) as DraftRecord, "Ana", settings);
  const completed = createRecordRowModel(buildRecordFixture({ status: "completed" }) as DraftRecord, "Ana", settings);
  const { rerender } = render(<RecordRow record={draft} ownerName="Ana" settings={settings} onOpenActions={jest.fn()} />);
  expect(screen.getByText(/Draft ·/)).toBeTruthy();
  expect(screen.queryByTestId("split-card-amount")).toBeNull();
  expect(screen.queryByText("Total")).toBeNull();

  rerender(<RecordRow record={completed} ownerName="Ana" settings={settings} onOpenActions={jest.fn()} />);
  expect(screen.getByTestId("split-card-amount")).toBeTruthy();
  expect(screen.getByText("Total")).toBeTruthy();
});

it("uses the agreed draft labels in both languages and tones", () => {
  const keys = ["record.step.setup", "record.step.participants", "record.step.payer", "record.step.items", "record.step.split", "record.step.settle"] as const;
  for (const [language, expected] of [
    ["en", ["Setup", "People", "Payer", "Items", "Split", "Settle"]],
    ["pt", ["Início", "Pessoas", "Pagador", "Itens", "Divisão", "Acerto"]],
  ] as const) {
    for (const humour of ["plain", "unhinged"] as const) {
      const settings = { language, humour };
      expect(keys.map((key) => translateWithSettings(settings, "record.status.pending", { step: translateWithSettings(settings, key) }))).toEqual(
        expected.map((step) => `${language === "en" ? "Draft" : "Rasc."} · ${step}`),
      );
    }
  }
});
