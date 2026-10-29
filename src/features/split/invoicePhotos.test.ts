const mockFs = { documentDirectory: "file:///app/", makeDirectoryAsync: jest.fn(), copyAsync: jest.fn(), deleteAsync: jest.fn(), getInfoAsync: jest.fn() };
const mockPicker = { requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() };
const mockImageManipulator = { manipulateAsync: jest.fn(), SaveFormat: { JPEG: "jpeg" } };
let persistInvoicePhoto: typeof import("./invoicePhotos").persistInvoicePhoto;
let removeInvoicePhoto: typeof import("./invoicePhotos").removeInvoicePhoto;
let chooseInvoicePhoto: typeof import("./invoicePhotos").chooseInvoicePhoto;
beforeEach(() => {
  jest.resetModules();
  jest.doMock("expo-file-system/legacy", () => mockFs);
  jest.doMock("expo-image-picker", () => mockPicker);
  jest.doMock("expo-image-manipulator", () => mockImageManipulator);
  ({ persistInvoicePhoto, removeInvoicePhoto, chooseInvoicePhoto } = require("./invoicePhotos"));
  jest.clearAllMocks();
  mockFs.deleteAsync.mockResolvedValue(undefined);
  mockImageManipulator.manipulateAsync.mockResolvedValue({ uri: "file:///cache/converted.jpg" });
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

it("uses available native file metadata and falls back for names without extensions", async () => {
  const onSelect = jest.fn();
  mockFs.getInfoAsync.mockResolvedValueOnce({ exists: true, size: 1234 });
  mockPicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///cache/receipt", fileName: "  " }] });
  await chooseInvoicePhoto(false, onSelect, "denied", "error");
  expect(onSelect).toHaveBeenCalledWith({ uri: "file:///cache/receipt", name: "invoice.jpg", size: 1234 });

  mockFs.getInfoAsync.mockResolvedValueOnce({ exists: false });
  mockPicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///cache/receipt" }] });
  await chooseInvoicePhoto(false, onSelect, "denied", "error");
  expect(onSelect).toHaveBeenLastCalledWith({ uri: "file:///cache/receipt", name: "invoice.jpg", size: null });
});

it("does not open the camera when permission is denied", async () => {
  mockPicker.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });
  const onSelect = jest.fn();
  await chooseInvoicePhoto(true, onSelect, "denied", "error");
  expect(mockPicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(onSelect).not.toHaveBeenCalled();
});

it("converts picked images to JPEG before copying them into owned storage", async () => {
  const photo = await persistInvoicePhoto("content://gallery/invoice.heic");
  expect(photo).toMatch(/^invoice-photos\/.+\.jpg$/);
  expect(mockImageManipulator.manipulateAsync).toHaveBeenCalledWith("content://gallery/invoice.heic", [], {
    compress: .85,
    format: "jpeg",
  });
  expect(mockFs.copyAsync).toHaveBeenCalledWith({ from: "file:///cache/converted.jpg", to: `file:///app/${photo}` });
  expect(mockFs.deleteAsync).toHaveBeenCalledWith("file:///cache/converted.jpg", { idempotent: true });
  await removeInvoicePhoto("content://gallery/invoice.png");
  expect(mockFs.deleteAsync).not.toHaveBeenCalledWith("content://gallery/invoice.png", { idempotent: true });
  await removeInvoicePhoto(photo);
  expect(mockFs.deleteAsync).toHaveBeenCalledWith(`file:///app/${photo}`, { idempotent: true });
});

it("normalizes legacy app-owned absolute URIs without recopying or deleting the wrong file", async () => {
  await expect(persistInvoicePhoto("file:///previous/container/Documents/invoice-photos/receipt.jpg"))
    .resolves.toBe("invoice-photos/receipt.jpg");

  await removeInvoicePhoto("file:///previous/container/Documents/invoice-photos/receipt.jpg");
  expect(mockFs.deleteAsync).toHaveBeenCalledWith("file:///app/invoice-photos/receipt.jpg", { idempotent: true });
  expect(mockImageManipulator.manipulateAsync).not.toHaveBeenCalled();
});

it("propagates copy failure so the previous attachment can remain saved", async () => {
  mockFs.copyAsync.mockRejectedValueOnce(new Error("disk full"));
  await expect(persistInvoicePhoto("file:///new.jpg")).rejects.toThrow("disk full");
});

it("requests base64 data for web camera captures", async () => {
  jest.resetModules();
  jest.doMock("react-native", () => {
    return { Alert: { alert: jest.fn() }, Platform: { OS: "web" } };
  });
  jest.doMock("expo-file-system/legacy", () => mockFs);
  jest.doMock("expo-image-picker", () => mockPicker);
  jest.doMock("expo-image-manipulator", () => mockImageManipulator);
  ({ chooseInvoicePhoto } = require("./invoicePhotos"));
  mockPicker.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: true });
  mockPicker.launchCameraAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: "blob:invoice", base64: "aW1hZ2U=", mimeType: "image/png" }],
  });
  const onSelect = jest.fn();

  await chooseInvoicePhoto(true, onSelect, "denied", "error");

  expect(mockPicker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ base64: true }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ uri: "data:image/png;base64,aW1hZ2U=" }));
  jest.dontMock("react-native");
});

it.each([
  ["aW1hZ2U==", 4],
  ["aW1hZ2U=", 5],
  ["aW1hZ2U", 5],
])("calculates web attachment size for base64 padding %s", async (base64, size) => {
  jest.resetModules();
  jest.doMock("react-native", () => ({ Alert: { alert: jest.fn() }, Platform: { OS: "web" } }));
  jest.doMock("expo-file-system/legacy", () => mockFs);
  jest.doMock("expo-image-picker", () => mockPicker);
  jest.doMock("expo-image-manipulator", () => mockImageManipulator);
  ({ chooseInvoicePhoto } = require("./invoicePhotos"));
  mockPicker.launchImageLibraryAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: "blob:receipt", base64 }],
  });
  const onSelect = jest.fn();

  await chooseInvoicePhoto(false, onSelect, "denied", "error");

  expect(onSelect).toHaveBeenCalledWith({
    uri: `data:image/jpeg;base64,${base64}`,
    name: "invoice.jpg",
    size,
  });
  jest.dontMock("react-native");
});

it("keeps web data URIs and already-owned files without converting them", async () => {
  jest.resetModules();
  jest.doMock("react-native", () => ({ Alert: { alert: jest.fn() }, Platform: { OS: "web" } }));
  jest.doMock("expo-file-system/legacy", () => mockFs);
  jest.doMock("expo-image-picker", () => mockPicker);
  jest.doMock("expo-image-manipulator", () => mockImageManipulator);
  ({ persistInvoicePhoto } = require("./invoicePhotos"));

  await expect(persistInvoicePhoto("data:image/png;base64,abc")).resolves.toBe("data:image/png;base64,abc");
  await expect(persistInvoicePhoto("file:///app/invoice-photos/saved.jpg")).resolves.toBe("invoice-photos/saved.jpg");
  await expect(persistInvoicePhoto(null)).resolves.toBeNull();
  expect(mockImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  jest.dontMock("react-native");
});

it("reports unavailable persistent storage instead of dropping a native attachment", async () => {
  jest.resetModules();
  jest.doMock("expo-file-system/legacy", () => ({ ...mockFs, documentDirectory: null }));
  jest.doMock("expo-image-picker", () => mockPicker);
  jest.doMock("expo-image-manipulator", () => mockImageManipulator);
  ({ persistInvoicePhoto } = require("./invoicePhotos"));

  await expect(persistInvoicePhoto("file:///cache/invoice.jpg")).rejects.toThrow("Invoice photo storage is unavailable.");
});
