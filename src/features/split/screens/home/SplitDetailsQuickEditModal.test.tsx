import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { Modal } from "react-native";

import { buildRecordFixture } from "../../integrationTestUtils";
import type { SplitTag } from "../../tags";
import { SplitDetailsQuickEditModal } from "./SplitDetailsQuickEditModal";

const mockInvoiceCopy = jest.fn(async (_paths: { from: string; to: string }) => undefined);

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///app/",
  copyAsync: (paths: { from: string; to: string }) => mockInvoiceCopy(paths),
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(async () => ({ uri: "file:///cache/converted.jpg" })),
  SaveFormat: { JPEG: "jpeg" },
}));

jest.mock("../shared/InvoicePhotoField", () => ({
  InvoicePhotoField: ({ onChange, disabled }: { onChange: (photo: object) => void; disabled: boolean }) => {
    const { Pressable, Text } = require("react-native");
    return <Pressable disabled={disabled} onPress={() => onChange({ uri: "file:///picked.jpg", name: "picked.jpg", size: 100 })}><Text>Pick QA photo</Text></Pressable>;
  },
}));

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
        splitDate: "2026-04-04",
        invoicePhotoUri: null,
        invoicePhotoName: null,
        invoicePhotoSize: null,
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
  beforeEach(() => mockInvoiceCopy.mockClear());

  it("keeps Edit details open during the photo copy and split write", async () => {
    let finishCopy!: () => void;
    let finishWrite!: () => void;
    mockInvoiceCopy.mockImplementationOnce(() => new Promise((resolve) => { finishCopy = () => resolve(undefined); }));
    const onSave = jest.fn(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
    const { props } = renderModal({ onSave });
    fireEvent.press(screen.getByText("Pick QA photo"));
    const submit = screen.getByLabelText("Save details");
    await act(async () => { fireEvent.press(submit); fireEvent.press(submit); });

    expect(mockInvoiceCopy).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Saving invoice photo…")).toBeDisabled();
    fireEvent.press(screen.getByLabelText("Cancel"));
    fireEvent.press(screen.getByLabelText("Dismiss action sheet"));
    fireEvent(screen.UNSAFE_getByType(Modal), "onRequestClose");
    expect(props.onCancel).not.toHaveBeenCalled();

    await act(async () => finishCopy());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ invoicePhotoUri: expect.stringMatching(/^invoice-photos\//), invoicePhotoName: "picked.jpg", invoicePhotoSize: 100 }));
    expect(screen.getByText("Edit split details")).toBeTruthy();
    fireEvent(screen.UNSAFE_getByType(Modal), "onRequestClose");
    expect(props.onCancel).not.toHaveBeenCalled();

    await act(async () => finishWrite());
    expect(screen.getByLabelText("Save details")).toBeEnabled();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it("keeps the selected photo on failure so saving can be retried", async () => {
    mockInvoiceCopy.mockRejectedValueOnce(new Error("copy failed"));
    const onSave = jest.fn<Promise<void>, [Parameters<QuickEditProps["onSave"]>[0]]>()
      .mockRejectedValueOnce(new Error("write failed"))
      .mockResolvedValue(undefined);
    renderModal({ onSave });
    fireEvent.press(screen.getByText("Pick QA photo"));
    await act(async () => fireEvent.press(screen.getByLabelText("Save details")));
    expect(screen.getByText(/Could not save the invoice photo/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => fireEvent.press(screen.getByLabelText("Save details")));
    expect(screen.getByText("Could not save split details. write failed")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByLabelText("Save details")));
    expect(mockInvoiceCopy).toHaveBeenCalledTimes(3);
    expect(onSave.mock.lastCall?.[0].invoicePhotoName).toBe("picked.jpg");
  });
  it("cancels from the backdrop and keeps invalid stored tags out of saves", async () => {
    const { props } = renderModal();

    fireEvent.press(screen.getByLabelText("Dismiss action sheet"));
    expect(props.onCancel).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save details"));
    });

    expect(props.onSave).toHaveBeenCalledWith({
      splitName: "Dinner",
        splitDate: "2026-04-04",
        invoicePhotoUri: null,
        invoicePhotoName: null,
        invoicePhotoSize: null,
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

  it("requires a non-empty split name before saving", async () => {
    const { props } = renderModal();
    fireEvent.changeText(screen.getByLabelText("Split name"), "   ");

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save details"));
    });

    expect(screen.getByText("Split name is missing.")).toBeTruthy();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("uses the retry message for non-Error save failures", async () => {
    renderModal({ onSave: jest.fn(async () => { throw "unexpected"; }) });

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save details"));
    });

    expect(screen.getByText("Could not save split details. Please try again.")).toBeTruthy();
  });

  it("deselects an existing tag before saving", async () => {
    const { props } = renderModal();

    fireEvent.press(screen.getByText("Groceries"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save details"));
    });

    expect(props.onSave).toHaveBeenCalledWith({
      splitName: "Dinner",
        splitDate: "2026-04-04",
        invoicePhotoUri: null,
        invoicePhotoName: null,
        invoicePhotoSize: null,
      tagIds: [],
    });
  });

  it("keeps the tag editor open when custom tag creation fails", async () => {
    const onAddTag = jest.fn(async () => false);
    renderModal({ onAddTag });

    fireEvent.press(screen.getByLabelText("Add tag"));
    await screen.findByPlaceholderText("Tag name");
    fireEvent.changeText(screen.getByPlaceholderText("Tag name"), "Beach");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Create Tag"));
    });

    expect(onAddTag).toHaveBeenCalledWith("Beach", "utensils", "orange");
    expect(screen.getByText("Create New Tag")).toBeTruthy();
  });

  it("cancels nested custom tag creation without closing quick edit", async () => {
    renderModal();

    fireEvent.changeText(screen.getByLabelText("Split name"), "Unsaved dinner");
    fireEvent.press(screen.getByLabelText("Add tag"));
    await screen.findByPlaceholderText("Tag name");
    expect(screen.queryByText("Edit split details")).toBeNull();
    fireEvent.press(screen.getAllByLabelText("Cancel").at(-1)!);

    expect(screen.queryByText("Create New Tag")).toBeNull();
    expect(screen.getByText("Edit split details")).toBeTruthy();
    expect(screen.getByLabelText("Split name").props.value).toBe("Unsaved dinner");
  });

  it("auto-selects a newly created tag when the settings tags refresh", async () => {
    const onSave = jest.fn(async () => undefined);
    const onAddTag = jest.fn(async () => true);
    const rendered = renderModal({ onAddTag, onSave });

    fireEvent.press(screen.getByLabelText("Add tag"));
    await screen.findByPlaceholderText("Tag name");
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
        splitDate: "2026-04-04",
        invoicePhotoUri: null,
        invoicePhotoName: null,
        invoicePhotoSize: null,
      tagIds: ["tag-groceries", "tag-beach"],
    });
  });

  it("preserves local tag changes when creating a new tag refreshes settings tags", async () => {
    const onSave = jest.fn(async () => undefined);
    const onAddTag = jest.fn(async () => true);
    const rendered = renderModal({ onAddTag, onSave });

    fireEvent.press(screen.getByText("Groceries"));
    fireEvent.press(screen.getByLabelText("Add tag"));
    await screen.findByPlaceholderText("Tag name");
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
        splitDate: "2026-04-04",
        invoicePhotoUri: null,
        invoicePhotoName: null,
        invoicePhotoSize: null,
      tagIds: ["tag-beach"],
    });
  });
});
