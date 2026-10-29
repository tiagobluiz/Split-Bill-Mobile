import { fireEvent, render, screen } from "@testing-library/react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform } from "react-native";
import { SplitDatePicker } from "./SplitDatePicker";

it("keeps the date on cancellation and applies the selected calendar day", () => {
  const open = jest.spyOn(DateTimePickerAndroid, "open").mockImplementation(() => undefined);
  const os = jest.replaceProperty(Platform, "OS", "android");
  const onChange = jest.fn();
  render(<SplitDatePicker value="2026-03-28" onChange={onChange} />);
  fireEvent.press(screen.getByLabelText("Split date"));
  const options = open.mock.calls[0][0];
  options.onChange?.({ type: "dismissed" } as any, undefined);
  expect(onChange).not.toHaveBeenCalled();
  options.onChange?.({ type: "set" } as any, new Date(2026, 2, 29, 12));
  expect(onChange).toHaveBeenCalledWith("2026-03-29");
  open.mockRestore();
  os.restore();
});

it("applies the iOS calendar selection on confirmation and preserves it on cancel", () => {
  const os = jest.replaceProperty(Platform, "OS", "ios");
  const onChange = jest.fn();
  render(<SplitDatePicker value="2026-03-28" onChange={onChange} />);
  fireEvent.press(screen.getByLabelText("Split date"));
  const picker = screen.UNSAFE_getByType(DateTimePicker);
  fireEvent(picker, "onChange", {}, undefined);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Cancel"));
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.press(screen.getByLabelText("Split date"));
  fireEvent(screen.UNSAFE_getByType(DateTimePicker), "onChange", {}, new Date(2026, 2, 29, 12));
  fireEvent.press(screen.getByText("Done"));
  expect(onChange).toHaveBeenCalledWith("2026-03-29");
  os.restore();
});

it("does not apply an Android dismissal or selection without a date", () => {
  const open = jest.spyOn(DateTimePickerAndroid, "open").mockImplementation(() => undefined);
  const os = jest.replaceProperty(Platform, "OS", "android");
  const onChange = jest.fn();
  render(<SplitDatePicker value="2026-03-28" onChange={onChange} />);
  fireEvent.press(screen.getByLabelText("Split date"));
  const options = open.mock.calls[0][0];
  options.onChange?.({ type: "set" } as any, undefined);
  expect(onChange).not.toHaveBeenCalled();
  open.mockRestore();
  os.restore();
});
