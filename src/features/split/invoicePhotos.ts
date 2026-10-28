import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";
import { createId } from "../../domain";

const directory = `${FileSystem.documentDirectory ?? ""}invoice-photos/`;

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
    const result = camera
      ? await ImagePicker.launchCameraAsync({ quality: .85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: .85, base64: Platform.OS === "web" });
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
  if (Platform.OS === "web" && uri.startsWith("data:image/")) return uri;
  if (!FileSystem.documentDirectory) throw new Error("Invoice photo storage is unavailable.");
  if (uri.startsWith(directory)) return uri;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = uri.match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1] ?? "jpg";
  const destination = `${directory}${createId()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function removeInvoicePhoto(uri?: string | null) {
  if (uri && uri.startsWith(directory)) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}
