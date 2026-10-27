export const PERSON_NAME_MAX_LENGTH = 25;

export type NamedPerson = { id?: string; name: string };
export type PersonNameValidationError<T extends NamedPerson = NamedPerson> =
  | { reason: "required" }
  | { reason: "max"; max: number }
  | { reason: "reserved" }
  | { reason: "duplicate"; person: T };

export function normalizePersonNameInput(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function personNameKey(value: string) {
  return normalizePersonNameInput(value).toLowerCase();
}

export function validatePersonName<T extends NamedPerson>(
  value: string,
  people: readonly T[] = [],
  selfId?: string,
  { allowOwnerPlaceholder = false }: { allowOwnerPlaceholder?: boolean } = {},
): PersonNameValidationError<T> | null {
  const name = normalizePersonNameInput(value);
  if (!name) return { reason: "required" };
  if (name.length > PERSON_NAME_MAX_LENGTH) return { reason: "max", max: PERSON_NAME_MAX_LENGTH };
  const key = personNameKey(name);
  if (!allowOwnerPlaceholder && key === "you") return { reason: "reserved" };
  const duplicate = people.find((person) =>
    (selfId === undefined || person.id !== selfId) && personNameKey(person.name) === key,
  );
  return duplicate ? { reason: "duplicate", person: duplicate } : null;
}
