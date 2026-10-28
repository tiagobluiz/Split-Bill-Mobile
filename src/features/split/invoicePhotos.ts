import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Alert, Platform } from "react-native";
import { createId } from "../../domain";
import {
  getInvoicePhotoRelativePath,
  resolveInvoicePhotoUri,
  sameInvoicePhotoUri,
} from "../../lib/invoicePhotoPaths";

const invoicePhotoDirectory = "invoice-photos/";

export type InvoicePhotoSelection = { uri: string; name: string; size: number | null };

function getFileName(uri: string, suggestedName?: string | null) {
  if (suggestedName?.trim()) return suggestedName.trim();
  const name = uri.split(/[?#]/, 1)[0]?.split("/").pop();
  return name && /\.[a-z0-9]{2,5}$/i.test(name) ? name : "invoice.jpg";
}

export async function chooseInvoicePhoto(camera: boolean, onSelect: (photo: InvoicePhotoSelection) => void, deniedMessage: string, errorMessage: string) {
  try {
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      Alert.alert(deniedMessage);
      return;
    }
    const pickerOptions = { quality: .85, base64: Platform.OS === "web" };
    const result = camera
      ? await ImagePicker.launchCameraAsync({ ...pickerOptions, mediaTypes: ["images"] })
      : await ImagePicker.launchImageLibraryAsync({ ...pickerOptions, mediaTypes: ["images"] });
    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      const uri = Platform.OS === "web" && asset.base64 ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}` : asset.uri;
      let size = typeof asset.fileSize === "number" ? asset.fileSize : null;
      if (size === null && Platform.OS === "web" && asset.base64) {
        const padding = asset.base64.endsWith("==") ? 2 : asset.base64.endsWith("=") ? 1 : 0;
        size = Math.floor(asset.base64.length * 3 / 4) - padding;
      }
      if (size === null && Platform.OS !== "web") {
        try {
          const info = await FileSystem.getInfoAsync(asset.uri);
          size = info.exists && "size" in info && typeof info.size === "number" ? info.size : null;
        } catch {
          // File metadata is optional; the attachment itself remains usable.
        }
      }
      onSelect({ uri, name: getFileName(asset.uri, asset.fileName), size });
    }
  } catch {
    Alert.alert(errorMessage);
  }
}

export async function persistInvoicePhoto(uri: string | null) {
  if (!uri) return null;
  if (uri.startsWith("data:image/")) return uri;
  if (!FileSystem.documentDirectory) throw new Error("Invoice photo storage is unavailable.");
  const existingRelativePath = getInvoicePhotoRelativePath(uri);
  if (existingRelativePath) return existingRelativePath;
  const documentDirectory = FileSystem.documentDirectory.endsWith("/")
    ? FileSystem.documentDirectory
    : `${FileSystem.documentDirectory}/`;
  const directory = `${documentDirectory}${invoicePhotoDirectory}`;
  const converted = await ImageManipulator.manipulateAsync(uri, [], {
    compress: .85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const relativePath = `${invoicePhotoDirectory}${createId()}.jpg`;
  const destination = `${documentDirectory}${relativePath}`;
  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    await FileSystem.copyAsync({ from: converted.uri, to: destination });
    return relativePath;
  } finally {
    await FileSystem.deleteAsync(converted.uri, { idempotent: true }).catch(() => undefined);
  }
}

export async function removeInvoicePhoto(uri?: string | null) {
  const relativePath = getInvoicePhotoRelativePath(uri);
  if (!relativePath || !FileSystem.documentDirectory) return;
  const resolvedUri = resolveInvoicePhotoUri(relativePath, FileSystem.documentDirectory);
  if (resolvedUri) await FileSystem.deleteAsync(resolvedUri, { idempotent: true }).catch(() => undefined);
}

export function getInvoicePhotoDisplayUri(uri: string | null | undefined) {
  return resolveInvoicePhotoUri(uri, FileSystem.documentDirectory);
}

export function areSameInvoicePhotos(first: string | null | undefined, second: string | null | undefined) {
  return sameInvoicePhotoUri(first, second);
}
