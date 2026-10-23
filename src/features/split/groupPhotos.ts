import * as FileSystem from "expo-file-system/legacy";

import { createId } from "../../domain";

const GROUP_PHOTO_DIRECTORY = `${FileSystem.documentDirectory ?? ""}group-photos/`;

export async function persistGroupPhoto(uri: string | null | undefined) {
  if (!uri || !FileSystem.documentDirectory || uri.startsWith(GROUP_PHOTO_DIRECTORY)) {
    return uri ?? null;
  }
  await FileSystem.makeDirectoryAsync(GROUP_PHOTO_DIRECTORY, { intermediates: true });
  const extension = uri.match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1] ?? "jpg";
  const destination = `${GROUP_PHOTO_DIRECTORY}${createId()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function removeGroupPhoto(uri: string | null | undefined) {
  if (!uri || !uri.startsWith(GROUP_PHOTO_DIRECTORY)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

export async function discardTemporaryGroupPhoto(uri: string | null | undefined) {
  await removeGroupPhoto(uri);
}
