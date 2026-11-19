import { withDatabaseTransaction } from "./database";
import { identityName, parseObject, readParticipants } from "./personIdentity";
import { readGroups, readPeople, writeGroup, writePerson } from "./directory";
import type { ParticipantGroup, SavedPerson } from "../features/split/people";

export type PersonDeletionResult = {
  result: "deleted" | "archived" | "missing";
  person?: SavedPerson;
  groups?: ParticipantGroup[];
  photoUri?: string | null;
};

export async function deleteSavedPerson(
  personId: string,
): Promise<PersonDeletionResult> {
  return withDatabaseTransaction(async (tx) => {
    const { people, ownerPersonId } = await readPeople(tx);
    const person = people.find((entry) => entry.id === personId);
    if (!person || personId === ownerPersonId)
      return { result: "missing" };
    const reference = await tx.getFirstAsync<{ found: number }>(
      "SELECT 1 AS found FROM split_person_memberships WHERE person_id = ? LIMIT 1",
      [personId],
    );
    const groups = (await readGroups(tx)).filter((group) => group.memberPersonIds.includes(personId));
    const usedInGroups = groups.length > 0;
    // Be conservative about unlinked legacy rows, even if an index was populated incompletely.
    const legacyRows =
      !reference && !usedInGroups
        ? await tx.getAllAsync<{ payload: string }>(
            "SELECT payload FROM split_records",
          )
        : [];
    const key = identityName(person.name);
    const ownerKey = identityName(people.find((entry) => entry.id === ownerPersonId)?.name ?? "You");
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
    if (!used) {
      await tx.runAsync("DELETE FROM people WHERE id = ?", [personId]);
      return { result: "deleted", photoUri: person.photoUri };
    }
    const archived = { ...person, archivedAt: person.archivedAt ?? timestamp, updatedAt: timestamp };
    await writePerson(tx, archived);
    const changedGroups: ParticipantGroup[] = [];
    for (const group of groups) {
      const updated = { ...group, memberPersonIds: group.memberPersonIds.filter((id) => id !== personId), updatedAt: timestamp };
      await writeGroup(tx, updated, group);
      changedGroups.push(updated);
    }
    return {
      result: "archived",
      person: archived,
      groups: changedGroups,
      photoUri: used ? null : person.photoUri,
    };
  });
}
