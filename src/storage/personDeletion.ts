import { withDatabaseTransaction } from "./database";
import { identityName, parseObject, readParticipants } from "./personIdentity";
import type { AppSettings } from "./settings";
import type { SavedPerson } from "../features/split/people";

export type PersonDeletionResult = {
  result: "deleted" | "archived" | "missing";
  settings?: AppSettings;
  photoUri?: string | null;
};

export async function deleteSavedPerson(
  personId: string,
): Promise<PersonDeletionResult> {
  return withDatabaseTransaction(async (tx) => {
    const row = await tx.getFirstAsync<{ payload: string }>(
      "SELECT payload FROM app_settings WHERE key = ?",
      ["app-settings"],
    );
    if (!row) return { result: "missing" };
    const settings = parseObject(row.payload, "settings") as AppSettings;
    const person = settings.people?.find((entry) => entry.id === personId);
    if (!person || personId === settings.ownerPersonId)
      return { result: "missing" };
    const reference = await tx.getFirstAsync<{ found: number }>(
      "SELECT 1 AS found FROM split_person_memberships WHERE person_id = ? LIMIT 1",
      [personId],
    );
    const usedInGroups = settings.participantGroups?.some((group) =>
      group.memberPersonIds.includes(personId),
    );
    // Be conservative about unlinked legacy rows, even if an index was populated incompletely.
    const legacyRows =
      !reference && !usedInGroups
        ? await tx.getAllAsync<{ payload: string }>(
            "SELECT payload FROM split_records",
          )
        : [];
    const key = identityName(person.name);
    const ownerKey = identityName(settings.ownerName ?? "You");
    const usedInLegacy =
      key !== ownerKey &&
      key !== "you" &&
      legacyRows.some((record) =>
        readParticipants(parseObject(record.payload, "split")).some(
          (entry) => !entry.personId && identityName(entry.name) === key,
        ),
      );
    const used = Boolean(reference || usedInGroups || usedInLegacy);
    const timestamp = new Date().toISOString();
    const people: SavedPerson[] = used
      ? settings.people!.map((entry) =>
          entry.id === personId
            ? {
                ...entry,
                archivedAt: entry.archivedAt ?? timestamp,
                updatedAt: timestamp,
              }
            : entry,
        )
      : settings.people!.filter((entry) => entry.id !== personId);
    const nextSettings = { ...settings, people };
    await tx.runAsync("UPDATE app_settings SET payload = ? WHERE key = ?", [
      JSON.stringify(nextSettings),
      "app-settings",
    ]);
    return {
      result: used ? "archived" : "deleted",
      settings: nextSettings,
      photoUri: used ? null : person.photoUri,
    };
  });
}
