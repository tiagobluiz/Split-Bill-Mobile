import {
  getInvoicePhotoRelativePath,
  resolveInvoicePhotoUri,
  sameInvoicePhotoUri,
} from "./invoicePhotoPaths";

describe("invoice photo paths", () => {
  it("resolves stable relative paths and legacy container URIs against the current app directory", () => {
    expect(resolveInvoicePhotoUri("invoice-photos/receipt.jpg", "file:///new/container/Documents/"))
      .toBe("file:///new/container/Documents/invoice-photos/receipt.jpg");
    expect(resolveInvoicePhotoUri("file:///old/container/Documents/invoice-photos/receipt.jpg", "file:///new/container/Documents/"))
      .toBe("file:///new/container/Documents/invoice-photos/receipt.jpg");
    expect(getInvoicePhotoRelativePath("file:///old/container/Documents/invoice-photos/receipt.jpg?cache=1"))
      .toBe("invoice-photos/receipt.jpg");
  });

  it("leaves external and web image URIs alone", () => {
    expect(resolveInvoicePhotoUri("content://gallery/receipt.jpg", "file:///app/"))
      .toBe("content://gallery/receipt.jpg");
    expect(resolveInvoicePhotoUri("data:image/png;base64,abc", "file:///app/"))
      .toBe("data:image/png;base64,abc");
    expect(resolveInvoicePhotoUri("invoice-photos/receipt.jpg", null))
      .toBe("invoice-photos/receipt.jpg");
    expect(resolveInvoicePhotoUri(null, "file:///app/")).toBeNull();
    expect(getInvoicePhotoRelativePath(null)).toBeNull();
  });

  it("compares current and legacy owned paths by stable identity", () => {
    expect(sameInvoicePhotoUri("invoice-photos/receipt.jpg", "file:///old/Documents/invoice-photos/receipt.jpg"))
      .toBe(true);
    expect(sameInvoicePhotoUri("invoice-photos/receipt.jpg", "invoice-photos/other.jpg"))
      .toBe(false);
    expect(sameInvoicePhotoUri("content://gallery/receipt.jpg", "content://gallery/receipt.jpg"))
      .toBe(true);
  });

  it("does not treat paths outside the invoice-photo directory as app-owned", () => {
    expect(getInvoicePhotoRelativePath("invoice-photos/../settings.json")).toBeNull();
    expect(getInvoicePhotoRelativePath("file:///external/invoice.jpg")).toBeNull();
  });
});
