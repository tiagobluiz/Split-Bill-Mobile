import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { InvoicePhotoField } from "./InvoicePhotoField";

const mockChooseInvoicePhoto = jest.fn();

jest.mock("../../invoicePhotos", () => ({
  chooseInvoicePhoto: (...args: any[]) => mockChooseInvoicePhoto(...args),
}));

beforeEach(() => mockChooseInvoicePhoto.mockClear());

it("offers camera and gallery sources from the invoice card", async () => {
  const onChange = jest.fn();
  render(<InvoicePhotoField value={null} onChange={onChange} />);

  fireEvent.press(screen.getByLabelText("Add invoice photo"));
  fireEvent.press(screen.getByText("Take invoice photo"));
  await waitFor(() => expect(mockChooseInvoicePhoto).toHaveBeenCalledWith(true, expect.any(Function), expect.any(String), expect.any(String)));

  mockChooseInvoicePhoto.mockClear();
  fireEvent.press(screen.getByLabelText("Add invoice photo"));
  fireEvent.press(screen.getByText("Choose invoice photo"));
  await waitFor(() => expect(mockChooseInvoicePhoto).toHaveBeenCalledWith(false, expect.any(Function), expect.any(String), expect.any(String)));
});

it("previews and removes the current invoice photo", async () => {
  const onChange = jest.fn();
  render(<InvoicePhotoField value="file:///invoice.jpg" fileName="continente-receipt.jpg" fileSize={2516582} onChange={onChange} />);

  expect(screen.getByText("continente-receipt.jpg")).toBeTruthy();
  expect(screen.getByText("2.4 MB")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Preview invoice photo"));
  expect(screen.getByLabelText("Close")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Close"));
  fireEvent.press(screen.getByLabelText("Remove photo"));

  expect(onChange).toHaveBeenCalledWith(null);
});
