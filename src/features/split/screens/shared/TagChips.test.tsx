import { fireEvent, render, screen } from "@testing-library/react-native";

import { TagChip, TagChipRow } from "./TagChips";

describe("TagChipRow", () => {
  it("copies layout measurements before updating state", () => {
    render(
      <TagChipRow
        tags={[
          {
            id: "restaurant",
            label: "Restaurant",
            icon: "utensils",
            color: "orange",
          },
          { id: "groceries", label: "Groceries", icon: "cart", color: "mint" },
          { id: "travel", label: "Travel", icon: "plane", color: "clay" },
        ]}
        selectedIds={["restaurant", "groceries", "travel"]}
      />,
    );

    fireEvent(screen.getAllByText("Restaurant")[0]!.parent!, "layout", {
      nativeEvent: {
        layout: {
          width: 90,
        },
      },
    });
    fireEvent(screen.getAllByText("Groceries")[0]!.parent!, "layout", {
      nativeEvent: {
        layout: {
          width: 86,
        },
      },
    });
    fireEvent(screen.getAllByText("Travel")[0]!.parent!, "layout", {
      nativeEvent: {
        layout: {
          width: 60,
        },
      },
    });

    expect(screen.getAllByText("Restaurant").length).toBeGreaterThan(0);
  });

  it("renders iconless tags", () => {
    render(
      <TagChipRow
        tags={[{ id: "custom", label: "Utilities", icon: null, color: "clay" }]}
        selectedIds={["custom"]}
      />,
    );

    expect(screen.getAllByText("Utilities").length).toBeGreaterThan(0);
  });

  it("renders custom icon and color tags", () => {
    render(
      <TagChipRow
        tags={[
          { id: "custom", label: "Fees", icon: "custom:%", color: "#3366cc" },
        ]}
        selectedIds={["custom"]}
      />,
    );

    expect(screen.getAllByText("%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fees").length).toBeGreaterThan(0);
  });

  it("renders an explicit label and selected chip state", () => {
    render(
      <TagChip
        tag={{
          id: "custom",
          label: "Hidden",
          icon: "heart",
          color: "mystery" as any,
        }}
        label="+2"
        selected
      />,
    );

    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("returns nothing when no selected tag ids are valid", () => {
    const view = render(
      <TagChipRow
        tags={[{ id: "custom", label: "Utilities", icon: null, color: "clay" }]}
        selectedIds={["missing"]}
      />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it("collapses overflowing tags into a +N chip after layout", () => {
    render(
      <TagChipRow
        tags={[
          {
            id: "restaurant",
            label: "Restaurant",
            icon: "utensils",
            color: "orange",
          },
          { id: "groceries", label: "Groceries", icon: "cart", color: "mint" },
          { id: "travel", label: "Travel", icon: "plane", color: "clay" },
        ]}
        selectedIds={["restaurant", "groceries", "travel"]}
      />,
    );

    fireEvent(screen.getByTestId("tag-row-measure-restaurant"), "layout", {
      nativeEvent: { layout: { width: 90 } },
    });
    fireEvent(screen.getByTestId("tag-row-measure-groceries"), "layout", {
      nativeEvent: { layout: { width: 86 } },
    });
    fireEvent(screen.getByTestId("tag-row-measure-travel"), "layout", {
      nativeEvent: { layout: { width: 60 } },
    });
    fireEvent(screen.getByTestId("tag-row-viewport"), "layout", {
      nativeEvent: { layout: { width: 150 } },
    });

    expect(screen.getByText("+2")).toBeTruthy();
  });
});
