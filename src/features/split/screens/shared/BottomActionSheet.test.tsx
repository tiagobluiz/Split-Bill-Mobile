import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Modal } from "react-native";
import { BottomActionSheet } from "./BottomActionSheet";

describe("BottomActionSheet", () => {
  afterEach(() => jest.useRealTimers());

  it("runs the dismissal completion after the native modal closes", () => {
    jest.useFakeTimers();
    const onDismissComplete = jest.fn();
    const view = render(
      <BottomActionSheet
        visible
        title="Actions"
        cancelLabel="Cancel"
        bottomInset={0}
        options={[]}
        onDismiss={jest.fn()}
        onDismissComplete={onDismissComplete}
      />,
    );

    view.rerender(
      <BottomActionSheet
        visible={false}
        title="Actions"
        cancelLabel="Cancel"
        bottomInset={0}
        options={[]}
        onDismiss={jest.fn()}
        onDismissComplete={onDismissComplete}
      />,
    );

    act(() => {
      screen.UNSAFE_getByType(Modal).props.onDismiss();
    });
    expect(onDismissComplete).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(350));
    expect(onDismissComplete).toHaveBeenCalledTimes(1);
  });

  it("uses the fallback when the platform does not report modal dismissal", () => {
    jest.useFakeTimers();
    const onDismissComplete = jest.fn();
    const view = render(
      <BottomActionSheet
        visible
        title="Actions"
        cancelLabel="Cancel"
        bottomInset={0}
        options={[]}
        onDismiss={jest.fn()}
        onDismissComplete={onDismissComplete}
      />,
    );

    view.rerender(
      <BottomActionSheet
        visible={false}
        title="Actions"
        cancelLabel="Cancel"
        bottomInset={0}
        options={[]}
        onDismiss={jest.fn()}
        onDismissComplete={onDismissComplete}
      />,
    );
    act(() => jest.advanceTimersByTime(350));

    expect(onDismissComplete).toHaveBeenCalledTimes(1);
  });

  it("keeps the fallback timer when the parent replaces its callback", () => {
    jest.useFakeTimers();
    const firstCallback = jest.fn();
    const latestCallback = jest.fn();
    const view = render(
      <BottomActionSheet
        visible
        title="Actions"
        cancelLabel="Cancel"
        bottomInset={0}
        options={[]}
        onDismiss={jest.fn()}
        onDismissComplete={firstCallback}
      />,
    );

    view.rerender(
      <BottomActionSheet
        visible={false}
        title="Actions"
        cancelLabel="Cancel"
        bottomInset={0}
        options={[]}
        onDismiss={jest.fn()}
        onDismissComplete={firstCallback}
      />,
    );
    view.rerender(
      <BottomActionSheet
        visible={false}
        title="Actions"
        cancelLabel="Cancel"
        bottomInset={0}
        options={[]}
        onDismiss={jest.fn()}
        onDismissComplete={latestCallback}
      />,
    );
    act(() => jest.advanceTimersByTime(350));

    expect(firstCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledTimes(1);
  });

  it("renders selection and action states and routes presses", () => {
    const onDismiss = jest.fn();
    const onSelect = jest.fn();
    const onDisabledPress = jest.fn();
    render(
      <BottomActionSheet
        visible
        title="Currency"
        cancelLabel="Cancel"
        bottomInset={20}
        selectionMode
        options={[
          { label: "Euro", onPress: onSelect, selected: true },
          { label: "Dollar", onPress: jest.fn(), selected: false },
          { label: "Disabled", onPress: onDisabledPress, disabled: true },
          { label: "Remove", onPress: jest.fn(), tone: "danger", description: "Delete photo" },
        ]}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.press(screen.getByLabelText("Euro"));
    fireEvent.press(screen.getByLabelText("Disabled"));
    fireEvent.press(screen.getByLabelText("Cancel"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onDisabledPress).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Delete photo")).toBeTruthy();
  });

  it("renders regular actions without a cancel row and supports system dismissal", () => {
    const onDismiss = jest.fn();
    const onSelectedPress = jest.fn();
    render(
      <BottomActionSheet
        visible
        title="Actions"
        cancelLabel="Cancel"
        bottomInset={0}
        showCancel={false}
        options={[
          { label: "Selected", onPress: onSelectedPress, selected: true },
          { label: "Continue", onPress: jest.fn() },
        ]}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.queryByText("Cancel")).toBeNull();
    fireEvent.press(screen.getByLabelText("Selected"));
    fireEvent(screen.UNSAFE_getByType(Modal), "onRequestClose");
    fireEvent.press(screen.getByLabelText("Dismiss action sheet"));
    expect(onSelectedPress).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
