import { fireEvent, render, screen } from "@testing-library/react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
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
