import type { OwnerProfilePatch } from "../../../../storage/records";
import type { SplitSettingsView } from "../../splitSettingsView";
import type { DraftRecord } from "../../../../storage/records";
import { PersonEditor } from "./PersonEditor";
import type { SavedPerson } from "../../people";
import type { SavePersonResult } from "../../store";
import { removePersonPhoto } from "../../personPhotos";

const OWNER_CREATED_AT = "1970-01-01T00:00:00.000Z";

export function OwnerProfileEditor({ settings, records, onSave, onClose, onBusyChange }: {
  settings: SplitSettingsView;
  records: DraftRecord[];
  onSave: (partial: OwnerProfilePatch) => Promise<void>;
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
      try {
        await onSave({
          ownerName: details.name,
          ownerProfileImageUri: details.photoUri ?? "",
          color: details.color,
          groupIds: details.groupIds,
        });
        if (owner.photoUri && owner.photoUri !== details.photoUri) {
          await removePersonPhoto(owner.photoUri);
        }
        return { ok: true, personId: owner.id };
      } catch {
        return { ok: false, reason: "persistence" };
      }
    }}
  />;
}
