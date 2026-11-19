import type { AppSettings } from "../../storage/settings";
import type { ParticipantGroup, SavedPerson } from "./people";

export type SplitSettingsView = AppSettings & {
  ownerName: string;
  ownerProfileImageUri: string;
  ownerPersonId?: string;
  profileSetupCompleted?: boolean;
  people?: SavedPerson[];
  participantGroups?: ParticipantGroup[];
};

type SplitSettingsState = {
  settings: AppSettings;
  people: SavedPerson[];
  participantGroups: ParticipantGroup[];
  ownerPersonId?: string;
  profileSetupCompleted: boolean;
  pendingOwnerName?: string;
};

let previous: SplitSettingsState | undefined;
let view: SplitSettingsView;

/** Compose the directory and preferences for screens that display both. */
export function selectSplitSettings(state: SplitSettingsState): SplitSettingsView {
  if (previous?.settings === state.settings && previous.people === state.people &&
      previous.participantGroups === state.participantGroups && previous.ownerPersonId === state.ownerPersonId &&
      previous.profileSetupCompleted === state.profileSetupCompleted && previous.pendingOwnerName === state.pendingOwnerName) return view;
  const owner = state.people?.find((person) => person.id === state.ownerPersonId);
  previous = {
    settings: state.settings, people: state.people, participantGroups: state.participantGroups,
    ownerPersonId: state.ownerPersonId, profileSetupCompleted: state.profileSetupCompleted,
    pendingOwnerName: state.pendingOwnerName,
  };
  view = {
    ...state.settings,
    ownerName: state.pendingOwnerName ?? owner?.name ?? "You",
    ownerProfileImageUri: owner?.photoUri ?? "",
    ownerPersonId: state.ownerPersonId,
    profileSetupCompleted: state.profileSetupCompleted,
    people: state.people,
    participantGroups: state.participantGroups,
  };
  return view;
}
