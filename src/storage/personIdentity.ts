import { uuid } from "expo-modules-core";
import type { SavedPerson } from "../features/split/people";

export type LegacyParticipant = {
  id: string;
  name: string;
  personId?: string;
  [key: string]: unknown;
};
export type IdentifiedParticipant = LegacyParticipant & { personId: string };
export type RawSplitRow = {
  id: string;
  status: string;
  step: number;
  payload: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};
export type PersonMembership = {
  splitId: string;
  participantId: string;
  personId: string;
};
export type IdentitySettings = Record<string, unknown> & {
  people: SavedPerson[];
  ownerPersonId: string;
};

export function identityName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseObject(
  payload: string,
  context: string,
): Record<string, any> {
  const value: unknown = JSON.parse(payload);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid ${context} payload`);
  return value as Record<string, any>;
}

export function readParticipants(
  payload: Record<string, any>,
): LegacyParticipant[] {
  const values = "values" in payload ? payload.values : payload;
  if (!values || !Array.isArray(values.participants))
    throw new Error("Invalid split participants");
  const seen = new Set<string>();
  for (const participant of values.participants) {
    if (
      !participant ||
      typeof participant.id !== "string" ||
      !participant.id.trim() ||
      typeof participant.name !== "string" ||
      !identityName(participant.name) ||
      seen.has(participant.id)
    ) {
      throw new Error("Invalid or repeated split participant");
    }
    if (
      participant.personId !== undefined &&
      (typeof participant.personId !== "string" || !participant.personId.trim())
    ) {
      throw new Error("Invalid global person reference");
    }
    seen.add(participant.id);
  }
  return values.participants;
}

function readPeople(settings: Record<string, any>) {
  if (settings.people !== undefined && !Array.isArray(settings.people))
    throw new Error("Invalid people collection");
  const people = (settings.people ?? []).map((person: SavedPerson) => ({
    ...person,
  })) as SavedPerson[];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const person of people) {
    if (
      !person ||
      typeof person.id !== "string" ||
      !person.id.trim() ||
      typeof person.name !== "string" ||
      !identityName(person.name) ||
      ids.has(person.id) ||
      names.has(identityName(person.name))
    ) {
      throw new Error("Conflicting saved person identities");
    }
    ids.add(person.id);
    names.add(identityName(person.name));
  }
  return people;
}

function validateGroups(settings: Record<string, any>, people: SavedPerson[]) {
  if (settings.participantGroups === undefined) return;
  if (!Array.isArray(settings.participantGroups))
    throw new Error("Invalid participant groups");
  const ids = new Set(people.map((person) => person.id));
  for (const group of settings.participantGroups) {
    if (
      !group ||
      !Array.isArray(group.memberPersonIds) ||
      group.memberPersonIds.some(
        (id: unknown) => typeof id !== "string" || !ids.has(id),
      )
    ) {
      throw new Error("Group references a missing person");
    }
  }
}

export function assertPersonRegistry(settings: Record<string, any>) {
  const people = readPeople(settings);
  validateGroups(settings, people);
  if (
    settings.ownerPersonId &&
    !people.some(
      (person) => person.id === settings.ownerPersonId && !person.archivedAt,
    )
  ) {
    throw new Error("Missing or archived owner identity");
  }
}

export function planPersonIdentity(
  originalSettings: Record<string, any>,
  rows: RawSplitRow[],
  newId: () => string = () => uuid.v4(),
  timestamp = new Date().toISOString(),
  canonicalizeLinkedNames = false,
) {
  const settings = { ...originalSettings };
  const people = readPeople(settings);
  const byId = new Map(people.map((person) => [person.id, person]));
  const byName = new Map(
    people.map((person) => [identityName(person.name), person]),
  );
  const parsed = [...rows]
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    )
    .map((row) => {
      const payload = parseObject(row.payload, "split");
      return { row, payload, participants: readParticipants(payload) };
    });
  const recoveredNames = new Map<string, string>();
  for (const { participants } of parsed)
    for (const participant of participants) {
      if (!participant.personId || byId.has(participant.personId)) continue;
      const previousName = recoveredNames.get(participant.personId);
      const key = identityName(participant.name);
      if (previousName && previousName !== key)
        throw new Error("Dangling person ID has inconsistent names");
      recoveredNames.set(participant.personId, key);
    }
  const add = (name: string, preferredId?: string, preserveDisplayName = false) => {
    let id = preferredId;
    for (let attempt = 0; !id || byId.has(id); attempt++) {
      if (attempt >= 10)
        throw new Error("Unable to allocate a unique person ID");
      id = newId();
    }
    const person: SavedPerson = {
      id,
      name: preserveDisplayName ? name.trim() : name.trim().replace(/\s+/g, " "),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    people.push(person);
    byId.set(id, person);
    byName.set(identityName(name), person);
    return person;
  };
  // Recover dangling IDs first so name-only rows can reuse them regardless of row order.
  for (const { participants } of parsed)
    for (const participant of participants) {
      if (!participant.personId || byId.has(participant.personId)) continue;
      if (byName.has(identityName(participant.name)))
        throw new Error("Dangling person ID conflicts with an existing person");
      add(participant.name, participant.personId);
    }
  const ownerName =
    typeof settings.ownerName === "string" && settings.ownerName.trim()
      ? settings.ownerName
      : "You";
  const ownerKey = identityName(ownerName);
  let owner =
    typeof settings.ownerPersonId === "string"
      ? byId.get(settings.ownerPersonId)
      : undefined;
  if (settings.ownerPersonId && !owner)
    throw new Error("Missing owner identity");
  if (!owner)
    owner = byName.get(ownerKey) ?? byName.get("you") ?? add(ownerName, undefined, true);
  if (owner.name !== ownerName.trim()) {
    const nameCollision = byName.get(ownerKey);
    if (nameCollision && nameCollision.id !== owner.id)
      throw new Error("Owner name conflicts with another person");
    const previousOwnerKey = identityName(owner.name);
    owner = { ...owner, name: ownerName.trim(), updatedAt: timestamp };
    const ownerIndex = people.findIndex((person) => person.id === owner!.id);
    if (ownerIndex >= 0) people[ownerIndex] = owner;
    byId.set(owner.id, owner);
    if (byName.get(previousOwnerKey)?.id === owner.id) byName.delete(previousOwnerKey);
    byName.set(ownerKey, owner);
  }
  if (owner.archivedAt) throw new Error("Owner identity is archived");
  const memberships: PersonMembership[] = [];
  const plannedRows = parsed.map(({ row, payload, participants }) => {
    const seenPeople = new Set<string>();
    const linked = participants.map((participant): IdentifiedParticipant => {
      const key = identityName(participant.name);
      const person = participant.personId
        ? byId.get(participant.personId)!
        : key === ownerKey || key === "you"
          ? owner!
          : (byName.get(key) ?? add(participant.name));
      if (seenPeople.has(person.id))
        throw new Error("A person occurs more than once in a split");
      seenPeople.add(person.id);
      memberships.push({
        splitId: row.id,
        participantId: participant.id,
        personId: person.id,
      });
      return {
        ...participant,
        ...(canonicalizeLinkedNames ? { name: person.name } : {}),
        personId: person.id,
      };
    });
    if ("values" in payload)
      payload.values = { ...payload.values, participants: linked };
    else payload.participants = linked;
    return { ...row, payload: JSON.stringify(payload) };
  });
  validateGroups(settings, people);
  return {
    settings: {
      ...settings,
      people,
      ownerPersonId: owner.id,
    } as IdentitySettings,
    rows: plannedRows,
    memberships,
  };
}

export function assertIdentityOnlyChange(
  before: RawSplitRow[],
  after: RawSplitRow[],
) {
  const originals = new Map(before.map((row) => [row.id, row]));
  if (originals.size !== after.length)
    throw new Error("Migration changed split count");
  for (const row of after) {
    const original = originals.get(row.id);
    if (!original) throw new Error("Migration added a split");
    const left = parseObject(original.payload, "split"),
      right = parseObject(row.payload, "split");
    const previous = readParticipants(left),
      current = readParticipants(right);
    if (previous.length !== current.length)
      throw new Error("Migration changed participant count");
    current.forEach((participant, index) => {
      if (
        !participant.personId ||
        (previous[index].personId &&
          previous[index].personId !== participant.personId)
      ) {
        throw new Error("Migration changed an existing identity");
      }
      if (previous[index].personId === undefined) delete participant.personId;
    });
    if (
      JSON.stringify(left) !== JSON.stringify(right) ||
      JSON.stringify({ ...original, payload: "" }) !==
        JSON.stringify({ ...row, payload: "" })
    ) {
      throw new Error("Migration changed non-identity split data");
    }
  }
}
