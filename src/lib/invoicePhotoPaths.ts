const INVOICE_PHOTO_DIRECTORY = "invoice-photos/";

function isValidInvoicePhotoPath(path: string) {
  return /^invoice-photos\/[^/]+$/.test(path) && !path.endsWith("/..");
}

/** Returns an app-owned invoice photo's stable path, accepting legacy file URIs. */
export function getInvoicePhotoRelativePath(uri: string | null | undefined) {
  if (!uri) return null;
  const path = uri.split(/[?#]/, 1)[0] ?? uri;
  if (path.startsWith(INVOICE_PHOTO_DIRECTORY)) {
    return isValidInvoicePhotoPath(path) ? path : null;
  }
  if (!path.startsWith("file://")) return null;

  const marker = `/${INVOICE_PHOTO_DIRECTORY}`;
  const markerIndex = path.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const relativePath = path.slice(markerIndex + 1);
  return isValidInvoicePhotoPath(relativePath) ? relativePath : null;
}

/** Resolves stable or legacy invoice photo paths against the current document directory. */
export function resolveInvoicePhotoUri(
  uri: string | null | undefined,
  documentDirectory: string | null | undefined,
) {
  if (!uri) return null;
  const relativePath = getInvoicePhotoRelativePath(uri);
  if (!relativePath || !documentDirectory) return uri;
  const directory = documentDirectory.endsWith("/")
    ? documentDirectory
    : `${documentDirectory}/`;
  return `${directory}${relativePath}`;
}

/** Compares stored photo identity across stable and legacy URI formats. */
export function sameInvoicePhotoUri(
  first: string | null | undefined,
  second: string | null | undefined,
) {
  if (first === second) return true;
  const firstPath = getInvoicePhotoRelativePath(first);
  const secondPath = getInvoicePhotoRelativePath(second);
  return firstPath !== null && firstPath === secondPath;
}
