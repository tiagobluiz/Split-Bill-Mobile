import { fireEvent, render, screen } from "@testing-library/react-native";
import { Modal, Platform } from "react-native";
import { InvoicePhotoField } from "./InvoicePhotoField";

const mockChooseInvoicePhoto = jest.fn();

jest.mock("../../invoicePhotos", () => ({
  chooseInvoicePhoto: (...args: any[]) => mockChooseInvoicePhoto(...args),
}));

beforeEach(() => mockChooseInvoicePhoto.mockClear());

it("offers camera and gallery sources from the invoice card", () => {
  const onChange = jest.fn();
  render(<InvoicePhotoField value={null} onChange={onChange} />);

  fireEvent.press(screen.getByLabelText("Add invoice photo"));
  fireEvent.press(screen.getByText("Take invoice photo"));
  expect(mockChooseInvoicePhoto).not.toHaveBeenCalled();
  fireEvent(screen.UNSAFE_getByType(Modal), "onDismiss");
  expect(mockChooseInvoicePhoto).toHaveBeenCalledWith(true, expect.any(Function), expect.any(String), expect.any(String));

  mockChooseInvoicePhoto.mockClear();
  fireEvent.press(screen.getByLabelText("Add invoice photo"));
  fireEvent.press(screen.getByText("Choose invoice photo"));
  expect(mockChooseInvoicePhoto).not.toHaveBeenCalled();
  fireEvent(screen.UNSAFE_getByType(Modal), "onDismiss");
  expect(mockChooseInvoicePhoto).toHaveBeenCalledWith(false, expect.any(Function), expect.any(String), expect.any(String));
});

it("opens the web picker within the photo-source press", () => {
  const os = jest.replaceProperty(Platform, "OS", "web");
  const onChange = jest.fn();
  render(<InvoicePhotoField value={null} onChange={onChange} />);

  fireEvent.press(screen.getByLabelText("Add invoice photo"));
  fireEvent.press(screen.getByText("Choose invoice photo"));

  expect(mockChooseInvoicePhoto).toHaveBeenCalledWith(false, expect.any(Function), expect.any(String), expect.any(String));
  os.restore();
});

it("previews and removes the current invoice photo", async () => {
  const onChange = jest.fn();
  render(<InvoicePhotoField value="file:///invoice.jpg" fileSize={2516582} onChange={onChange} />);

  expect(screen.getByText("Invoice")).toBeTruthy();
  expect(screen.getByText("2.4 MB")).toBeTruthy();
  fireEvent.press(screen.getByText("Invoice"));
  expect(screen.getByLabelText("Close")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Close"));
  fireEvent.press(screen.getByLabelText("Remove photo"));

  expect(onChange).toHaveBeenCalledWith(null);
  expect(screen.queryByLabelText("Close")).toBeNull();
});

it.each([
  [512, "512 B"],
  [1536, "2 KB"],
  [Number.POSITIVE_INFINITY, "Size unavailable"],
  [-1, "Size unavailable"],
])("formats an invoice file size of %s", (fileSize, expected) => {
  render(<InvoicePhotoField value="file:///invoice.jpg" fileSize={fileSize} onChange={jest.fn()} />);
  expect(screen.getByText(expected)).toBeTruthy();
});
