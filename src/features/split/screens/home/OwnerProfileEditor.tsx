import type { AppSettings } from "../../../../storage/settings";
import type { DraftRecord } from "../../../../storage/records";
import { PersonEditor } from "./PersonEditor";
import type { SavedPerson } from "../../people";
import type { SavePersonResult } from "../../store";

const OWNER_CREATED_AT = "1970-01-01T00:00:00.000Z";

export function OwnerProfileEditor({ settings, records, onSave, onClose, onBusyChange }: {
  settings: AppSettings;
  records: DraftRecord[];
  onSave: (partial: Partial<AppSettings>) => Promise<void>;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const storedOwner = settings.people?.find((person) => person.id === settings.ownerPersonId);
  const owner: SavedPerson = {
    id: settings.ownerPersonId ?? "owner-profile",
    name: settings.ownerName,
    photoUri: settings.ownerProfileImageUri || null,
    color: storedOwner?.color,
    createdAt: storedOwner?.createdAt ?? OWNER_CREATED_AT,
    updatedAt: storedOwner?.updatedAt ?? OWNER_CREATED_AT,
  };
  const groups = settings.participantGroups ?? [];

  return <PersonEditor
    person={owner}
    people={settings.people ?? []}
    groups={groups}
    records={records}
    onBusyChange={onBusyChange}
    onCancel={onClose}
    onOpenExisting={() => undefined}
    onSave={async (details): Promise<SavePersonResult> => {
      const people = (settings.people ?? []).map((person) => person.id === settings.ownerPersonId
        ? { ...person, name: details.name, photoUri: details.photoUri, color: details.color, updatedAt: new Date().toISOString() }
        : person);
      const participantGroups = settings.ownerPersonId ? groups.map((group) => ({
        ...group,
        memberPersonIds: details.groupIds.includes(group.id)
          ? [...new Set([...group.memberPersonIds, owner.id])]
          : group.memberPersonIds.filter((personId) => personId !== owner.id),
      })) : groups;
      try {
        await onSave({
          ownerName: details.name,
          ownerProfileImageUri: details.photoUri ?? "",
          people,
          participantGroups,
        });
        return { ok: true, personId: owner.id };
      } catch {
        return { ok: false, reason: "persistence" };
      }
    }}
  />;
}
