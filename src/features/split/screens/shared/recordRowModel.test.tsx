import { fireEvent, render, screen } from "@testing-library/react-native";
import { buildRecordFixture } from "../../integrationTestUtils";
import type { DraftRecord } from "../../../../storage/records";
import { RecordRow } from "./homeParts";
import { createRecordRowModel } from "./recordRowModel";

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
});
