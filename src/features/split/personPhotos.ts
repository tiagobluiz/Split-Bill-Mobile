import * as FileSystem from "expo-file-system/legacy";

import { createId } from "../../domain";

const PERSON_PHOTO_DIRECTORY = `${FileSystem.documentDirectory ?? ""}person-photos/`;

export async function persistPersonPhoto(uri: string | null | undefined) {
  if (!uri || !FileSystem.documentDirectory || uri.startsWith(PERSON_PHOTO_DIRECTORY)) {
    return uri ?? null;
  }
  await FileSystem.makeDirectoryAsync(PERSON_PHOTO_DIRECTORY, { intermediates: true });
  const extension = uri.match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1] ?? "jpg";
  const destination = `${PERSON_PHOTO_DIRECTORY}${createId()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function removePersonPhoto(uri: string | null | undefined) {
  if (!uri || !uri.startsWith(PERSON_PHOTO_DIRECTORY)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

export async function discardTemporaryPersonPhoto(uri: string | null | undefined) {
  await removePersonPhoto(uri);
}
