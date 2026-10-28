const mockFs = { documentDirectory: "file:///app/", makeDirectoryAsync: jest.fn(), copyAsync: jest.fn(), deleteAsync: jest.fn() };
const mockPicker = { requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() };
let persistInvoicePhoto: typeof import("./invoicePhotos").persistInvoicePhoto;
let removeInvoicePhoto: typeof import("./invoicePhotos").removeInvoicePhoto;
let chooseInvoicePhoto: typeof import("./invoicePhotos").chooseInvoicePhoto;
beforeEach(() => {
  jest.resetModules();
  jest.doMock("expo-file-system/legacy", () => mockFs);
  jest.doMock("expo-image-picker", () => mockPicker);
  ({ persistInvoicePhoto, removeInvoicePhoto, chooseInvoicePhoto } = require("./invoicePhotos"));
  jest.clearAllMocks();
  mockFs.deleteAsync.mockResolvedValue(undefined);
});

it("leaves the existing photo unchanged when selection is cancelled", async () => {
  const onSelect = jest.fn();
  mockPicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true });
  await chooseInvoicePhoto(false, onSelect, "denied", "error");
  expect(onSelect).not.toHaveBeenCalled();
});

it("passes a selected photo to the editor", async () => {
  const onSelect = jest.fn();
  mockPicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///invoice.png" }] });
  await chooseInvoicePhoto(false, onSelect, "denied", "error");
  expect(onSelect).toHaveBeenCalledWith({ uri: "file:///invoice.png", name: "invoice.png", size: null });
});

it("preserves the picked filename and file size for the split summary", async () => {
  const onSelect = jest.fn();
  mockPicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///cache/image.jpg", fileName: "market-receipt.jpg", fileSize: 2516582 }] });
  await chooseInvoicePhoto(false, onSelect, "denied", "error");
  expect(onSelect).toHaveBeenCalledWith({ uri: "file:///cache/image.jpg", name: "market-receipt.jpg", size: 2516582 });
});

it("does not open the camera when permission is denied", async () => {
  mockPicker.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });
  const onSelect = jest.fn();
  await chooseInvoicePhoto(true, onSelect, "denied", "error");
  expect(mockPicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(onSelect).not.toHaveBeenCalled();
});

it("copies an invoice into owned storage and removes only owned files", async () => {
  const photo = await persistInvoicePhoto("content://gallery/invoice.png");
  expect(photo).toMatch(/^file:\/\/\/app\/invoice-photos\/.+\.png$/);
  expect(mockFs.copyAsync).toHaveBeenCalledWith({ from: "content://gallery/invoice.png", to: photo });
  await removeInvoicePhoto("content://gallery/invoice.png");
  expect(mockFs.deleteAsync).not.toHaveBeenCalled();
  await removeInvoicePhoto(photo);
  expect(mockFs.deleteAsync).toHaveBeenCalledWith(photo, { idempotent: true });
});

it("propagates copy failure so the previous attachment can remain saved", async () => {
  mockFs.copyAsync.mockRejectedValueOnce(new Error("disk full"));
  await expect(persistInvoicePhoto("file:///new.jpg")).rejects.toThrow("disk full");
});
