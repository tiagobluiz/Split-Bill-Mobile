import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { buildRecordFixture } from "../../integrationTestUtils";
import type { SplitTag } from "../../tags";
import { SplitDetailsQuickEditModal } from "./SplitDetailsQuickEditModal";

const baseTags: SplitTag[] = [
  {
    id: "tag-restaurant",
    label: "Restaurant",
    icon: "utensils",
    color: "orange",
  },
  {
    id: "tag-groceries",
    label: "Groceries",
    icon: "cart",
    color: "mint",
  },
];

type QuickEditProps = ComponentProps<typeof SplitDetailsQuickEditModal>;

function renderModal(overrides: Partial<QuickEditProps> = {}) {
  const record = buildRecordFixture();
  const props: QuickEditProps = {
    record: {
      ...record,
      values: {
        ...record.values,
        splitName: "Dinner",
        tagIds: ["tag-groceries", "missing"],
      } as QuickEditProps["record"]["values"],
    },
    tags: baseTags,
    onSave: jest.fn(async () => undefined),
    onCancel: jest.fn(),
    onAddTag: jest.fn(async () => true),
    ...overrides,
  };

  return {
    ...render(<SplitDetailsQuickEditModal {...props} />),
    props,
  };
}

describe("SplitDetailsQuickEditModal", () => {
  it("cancels from the backdrop and keeps invalid stored tags out of saves", async () => {
    const { props } = renderModal();

    fireEvent.press(screen.getByLabelText("Dismiss action sheet"));
    expect(props.onCancel).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save details"));
    });

    expect(props.onSave).toHaveBeenCalledWith({
      splitName: "Dinner",
      tagIds: ["tag-groceries"],
    });
  });

  it("keeps the modal open when saving fails", async () => {
    renderModal({
      onSave: jest.fn(async () => {
        throw new Error("offline");
      }),
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save details"));
    });

    expect(
      screen.getByText("Could not save split details. offline"),
    ).toBeTruthy();
    expect(screen.getByText("Edit split details")).toBeTruthy();
  });

  it("deselects an existing tag before saving", async () => {
    const { props } = renderModal();

    fireEvent.press(screen.getByText("Groceries"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save details"));
    });

    expect(props.onSave).toHaveBeenCalledWith({
      splitName: "Dinner",
      tagIds: [],
    });
  });

  it("keeps the tag editor open when custom tag creation fails", async () => {
    const onAddTag = jest.fn(async () => false);
    renderModal({ onAddTag });

    fireEvent.press(screen.getByLabelText("Add tag"));
    fireEvent.changeText(screen.getByPlaceholderText("Tag name"), "Beach");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Create Tag"));
    });

    expect(onAddTag).toHaveBeenCalledWith("Beach", "utensils", "orange");
    expect(screen.getByText("Create New Tag")).toBeTruthy();
  });

  it("cancels nested custom tag creation without closing quick edit", () => {
    renderModal();

    fireEvent.press(screen.getByLabelText("Add tag"));
    fireEvent.press(screen.getAllByLabelText("Cancel").at(-1)!);

    expect(screen.queryByText("Create New Tag")).toBeNull();
    expect(screen.getByText("Edit split details")).toBeTruthy();
  });

  it("auto-selects a newly created tag when the settings tags refresh", async () => {
    const onSave = jest.fn(async () => undefined);
    const onAddTag = jest.fn(async () => true);
    const rendered = renderModal({ onAddTag, onSave });

    fireEvent.press(screen.getByLabelText("Add tag"));
    fireEvent.changeText(screen.getByPlaceholderText("Tag name"), "Beach");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Create Tag"));
    });

    expect(onAddTag).toHaveBeenCalledWith("Beach", "utensils", "orange");

    rendered.rerender(
      <SplitDetailsQuickEditModal
        {...rendered.props}
        tags={[
          ...baseTags,
          { id: "tag-beach", label: "Beach", icon: "plane", color: "clay" },
        ]}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save details"));
    });

    expect(onSave).toHaveBeenCalledWith({
      splitName: "Dinner",
      tagIds: ["tag-groceries", "tag-beach"],
    });
  });

  it("preserves local tag changes when creating a new tag refreshes settings tags", async () => {
    const onSave = jest.fn(async () => undefined);
    const onAddTag = jest.fn(async () => true);
    const rendered = renderModal({ onAddTag, onSave });

    fireEvent.press(screen.getByText("Groceries"));
    fireEvent.press(screen.getByLabelText("Add tag"));
    fireEvent.changeText(screen.getByPlaceholderText("Tag name"), "Beach");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Create Tag"));
    });

    rendered.rerender(
      <SplitDetailsQuickEditModal
        {...rendered.props}
        tags={[
          ...baseTags,
          { id: "tag-beach", label: "Beach", icon: "plane", color: "clay" },
        ]}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save details"));
    });

    expect(onSave).toHaveBeenCalledWith({
      splitName: "Dinner",
      tagIds: ["tag-beach"],
    });
  });
});
