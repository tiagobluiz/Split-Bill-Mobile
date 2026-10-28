import { fireEvent, render, screen } from "@testing-library/react-native";
import { SplitDatePicker } from "./SplitDatePicker.web";

it("applies a chosen web calendar day and preserves the saved value on cancel", () => {
  const onChange = jest.fn();
  render(<SplitDatePicker value="2026-10-28" onChange={onChange} />);

  fireEvent.press(screen.getByLabelText("Split date"));
  const input = screen.getAllByLabelText("Split date")[1];
  fireEvent(input, "onChange", { target: { value: "2026-11-02" } });
  fireEvent.press(screen.getByText("Cancel"));
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.press(screen.getByLabelText("Split date"));
  fireEvent(screen.getAllByLabelText("Split date")[1], "onChange", { target: { value: "2026-11-02" } });
  fireEvent.press(screen.getByText("Done"));
  expect(onChange).toHaveBeenCalledWith("2026-11-02");
});

it("does not apply an empty web calendar value", () => {
  const onChange = jest.fn();
  render(<SplitDatePicker value="2026-10-28" onChange={onChange} />);
  fireEvent.press(screen.getByLabelText("Split date"));
  fireEvent(screen.getAllByLabelText("Split date")[1], "onChange", { target: { value: "" } });
  fireEvent.press(screen.getByText("Done"));
  expect(onChange).not.toHaveBeenCalled();
});
