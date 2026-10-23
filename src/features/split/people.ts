import { createId, trimName } from "../../domain";
import { uuid } from "expo-modules-core";
import type { DraftRecord } from "../../storage/records";
import type { SplitTagColor, SplitTagIcon } from "./tags";

export type SavedPerson = {
  id: string;
  name: string;
  photoUri?: string | null;
  color?: SplitTagColor;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParticipantGroup = {
  id: string;
  name: string;
  description?: string;
  photoUri?: string | null;
  icon?: SplitTagIcon | null;
  color?: SplitTagColor;
  memberPersonIds: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export const PERSON_NAME_MAX_LENGTH = 25;
export const GROUP_NAME_MAX_LENGTH = 32;
export const FREQUENT_ENTRY_LIMIT = 15;

function nowIso() {
  return new Date().toISOString();
}

export function normalizePeople(value: unknown): SavedPerson[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  return value
    .map((entry): SavedPerson | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const raw = entry as Partial<SavedPerson>;
      if (typeof raw.id !== "string" || typeof raw.name !== "string") {
        return null;
      }
      const id = raw.id.trim();
      const name = trimName(raw.name);
      const key = name.toLowerCase();
      if (!id || !name || seenIds.has(id) || seenNames.has(key)) {
        return null;
      }
      seenIds.add(id);
      seenNames.add(key);
      const createdAt =
        typeof raw.createdAt === "string" && raw.createdAt.trim()
          ? raw.createdAt
          : nowIso();
      const updatedAt =
        typeof raw.updatedAt === "string" && raw.updatedAt.trim()
          ? raw.updatedAt
          : createdAt;
      return {
        id,
        name,
        ...(typeof raw.photoUri === "string" && raw.photoUri.trim()
          ? { photoUri: raw.photoUri.trim() }
          : {}),
        ...(typeof raw.color === "string" ? { color: raw.color as SplitTagColor } : {}),
        ...(typeof raw.archivedAt === "string" && raw.archivedAt.trim()
          ? { archivedAt: raw.archivedAt }
          : {}),
        createdAt,
        updatedAt,
      };
    })
    .filter((entry): entry is SavedPerson => Boolean(entry));
}

export function mergePeopleRegistry(currentValue: unknown, requestedValue: unknown): SavedPerson[] {
  const current = normalizePeople(currentValue);
  const requested = normalizePeople(requestedValue);
  const requestedById = new Map(requested.map((person) => [person.id, person]));
  const merged = current.map((person) => {
    const update = requestedById.get(person.id);
    if (!update) return person;
    requestedById.delete(person.id);
    return update.updatedAt > person.updatedAt ? update : person;
  });
  merged.push(...requestedById.values());
  return normalizePeople(merged);
}

export function normalizeGroups(
  value: unknown,
  people: SavedPerson[] = [],
): ParticipantGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validPersonIds = new Set(people.map((person) => person.id));
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  return value
    .map((entry): ParticipantGroup | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const raw = entry as Partial<ParticipantGroup>;
      if (typeof raw.id !== "string" || typeof raw.name !== "string") {
        return null;
      }
      const id = raw.id.trim();
      const name = trimName(raw.name).slice(0, GROUP_NAME_MAX_LENGTH);
      const key = name.toLowerCase();
      if (!id || !name || seenIds.has(id) || seenNames.has(key)) {
        return null;
      }
      const memberPersonIds = Array.isArray(raw.memberPersonIds)
        ? [...new Set(raw.memberPersonIds.filter((memberId) => typeof memberId === "string").map((memberId) => memberId.trim()))].filter((memberId) =>
            validPersonIds.has(memberId),
          )
        : [];
      if (memberPersonIds.length === 0) {
        return null;
      }
      seenIds.add(id);
      seenNames.add(key);
      const createdAt =
        typeof raw.createdAt === "string" && raw.createdAt.trim()
          ? raw.createdAt
          : nowIso();
      const updatedAt =
        typeof raw.updatedAt === "string" && raw.updatedAt.trim()
          ? raw.updatedAt
          : createdAt;
      return {
        id,
        name,
        ...(typeof raw.description === "string"
          ? { description: raw.description.trim().slice(0, 300) || undefined }
          : {}),
        ...(typeof raw.photoUri === "string" && raw.photoUri.trim()
          ? { photoUri: raw.photoUri.trim() }
          : {}),
        ...(typeof raw.icon === "string" ? { icon: raw.icon as SplitTagIcon } : {}),
        ...(typeof raw.color === "string" ? { color: raw.color as SplitTagColor } : {}),
        memberPersonIds,
        usageCount:
          typeof raw.usageCount === "number" && Number.isFinite(raw.usageCount)
            ? Math.max(0, Math.floor(raw.usageCount))
            : 0,
        createdAt,
        updatedAt,
      };
    })
    .filter((entry): entry is ParticipantGroup => Boolean(entry));
}

export function normalizePersonName(value: string) {
  return trimName(value).slice(0, PERSON_NAME_MAX_LENGTH);
}

export function normalizeGroupName(value: string) {
  return trimName(value).slice(0, GROUP_NAME_MAX_LENGTH);
}

export function findPersonByName(people: SavedPerson[], name: string) {
  const normalized = normalizePersonName(name).toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return people.find((person) => person.name.trim().toLowerCase() === normalized);
}

export function createPerson(name: string): SavedPerson | null {
  const normalizedName = normalizePersonName(name);
  if (!normalizedName) {
    return null;
  }
  const timestamp = nowIso();
  return {
    id: uuid.v4(),
    name: normalizedName,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createGroup(
  name: string,
  memberPersonIds: string[],
): ParticipantGroup | null {
  const normalizedName = normalizeGroupName(name);
  const members = [...new Set(memberPersonIds.map((id) => id.trim()).filter(Boolean))];
  if (!normalizedName || members.length === 0) {
    return null;
  }
  const timestamp = nowIso();
  return {
    id: createId(),
    name: normalizedName,
    memberPersonIds: members,
    usageCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function sortPeopleByName<T extends { name: string }>(people: T[]) {
  return [...people].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

export function sortGroupsForFrequent(groups: ParticipantGroup[]) {
  return [...groups].sort((left, right) => {
    const leftUsed = left.usageCount > 0;
    const rightUsed = right.usageCount > 0;
    if (leftUsed !== rightUsed) {
      return leftUsed ? -1 : 1;
    }
    if (leftUsed && right.usageCount !== left.usageCount) {
      return right.usageCount - left.usageCount;
    }
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });
}

export function isPersonUsedInRecords(personId: string, records: DraftRecord[]) {
  return records.some((record) =>
    record.values.participants.some((participant) => participant.personId === personId),
  );
}

export function isPersonUsedInGroups(personId: string, groups: ParticipantGroup[]) {
  return groups.some((group) => group.memberPersonIds.includes(personId));
}
