import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { LocalizationProvider } from "../../../../i18n/provider";
import type { ParticipantGroup, SavedPerson } from "../../people";
import { getAvatarTone } from "../shared/participantUtils";
import { PersonEditor } from "./PersonEditor";
import type { SavePersonResult } from "../../store";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: "file:///camera/person.jpg" }] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: "file:///library/person.jpg" }] })),
}));
jest.mock("../../contacts", () => ({
  loadContacts: jest.fn(async () => ({
    Fields: { Name: "name", Image: "image" },
    requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    getContactsAsync: jest.fn(async () => ({ data: [
      { id: "contact-1", name: "Carla Silva", image: { uri: "file:///contacts/carla.jpg" } },
      { id: "contact-2", name: "Daniel" },
      { id: "contact-3", name: "" },
    ] })),
  })),
}));
jest.mock("../../personPhotos", () => ({
  discardTemporaryPersonPhoto: jest.fn(async () => undefined),
  persistPersonPhoto: jest.fn(async (uri: string) => `file:///owned/${uri.split("/").pop()}`),
  removePersonPhoto: jest.fn(async () => undefined),
}));

const group: ParticipantGroup = {
  id: "group-roomies",
  name: "Roomies",
  memberPersonIds: ["person-existing"],
  usageCount: 0,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const existing: SavedPerson = {
  id: "person-existing",
  name: "Ana",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

function renderEditor({ people = [], person = null, groups = [group], onOpenExisting = jest.fn(), onSave = jest.fn(async () => ({ ok: true as const, personId: "person-new" })) }: {
  people?: SavedPerson[];
  person?: SavedPerson | null;
  groups?: ParticipantGroup[];
  onOpenExisting?: jest.Mock;
  onSave?: jest.Mock;
} = {}) {
  return render(<LocalizationProvider language="en" humour="plain"><PersonEditor person={person} people={people} groups={groups} records={[]} onCancel={jest.fn()} onOpenExisting={onOpenExisting} onSave={onSave} /></LocalizationProvider>);
}

describe("PersonEditor", () => {
  afterEach(() => {
    const ImagePicker = require("expo-image-picker");
    ImagePicker.requestCameraPermissionsAsync.mockReset().mockResolvedValue({ granted: true });
    ImagePicker.requestMediaLibraryPermissionsAsync.mockReset().mockResolvedValue({ granted: true });
    ImagePicker.launchCameraAsync.mockReset().mockResolvedValue({ canceled: false, assets: [{ uri: "file:///camera/person.jpg" }] });
    ImagePicker.launchImageLibraryAsync.mockReset().mockResolvedValue({ canceled: false, assets: [{ uri: "file:///library/person.jpg" }] });
  });

  it("requires an explicit choice before using an imported photo for an existing person without a photo", () => {
    render(
      <LocalizationProvider language="en" humour="plain">
        <PersonEditor person={existing} people={[existing]} groups={[]} records={[]} suggestedContactPhoto="file:///contacts/ana.jpg" onCancel={jest.fn()} onOpenExisting={jest.fn()} onSave={jest.fn()} />
      </LocalizationProvider>,
    );
    expect(screen.getByText("Use photo from this contact")).toBeTruthy();
    expect(screen.getByText("Background color")).toBeTruthy();
  });

  it("offers to load an existing active person instead of saving a duplicate", () => {
    const onOpenExisting = jest.fn();
    renderEditor({ people: [existing], onOpenExisting });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "  ANA  ");
    expect(screen.getByText("A person named Ana already exists.")).toBeTruthy();

    fireEvent.press(screen.getByText("Edit existing person"));

    expect(onOpenExisting).toHaveBeenCalledWith(existing, null);
  });

  it("does not flash a duplicate warning when the saved person arrives before the editor closes", async () => {
    let resolveSave!: (result: SavePersonResult) => void;
    const onSave = jest.fn(() => new Promise<SavePersonResult>((resolve) => { resolveSave = resolve; }));
    const onBusyChange = jest.fn();
    const onCancel = jest.fn(() => {
      expect(onBusyChange).toHaveBeenLastCalledWith(false);
    });
    const savedPerson = { ...existing, id: "person-new", name: "Carla" };
    const editor = (people: SavedPerson[]) => (
      <LocalizationProvider language="en" humour="plain">
        <PersonEditor person={null} people={people} groups={[]} records={[]} onCancel={onCancel} onOpenExisting={jest.fn()} onSave={onSave} onBusyChange={onBusyChange} />
      </LocalizationProvider>
    );
    const { rerender } = render(editor([]));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });

    rerender(editor([savedPerson]));
    expect(screen.queryByText("A person named Carla already exists.")).toBeNull();
    expect(screen.queryByText("Edit existing person")).toBeNull();
    expect(screen.getByText("Import from contacts")).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => { resolveSave({ ok: true, personId: savedPerson.id }); });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("A person named Carla already exists.")).toBeNull();
    expect(screen.queryByText("Edit existing person")).toBeNull();
    expect(screen.getByText("Import from contacts")).toBeTruthy();
  });

  it("resumes duplicate validation against refreshed people after a save fails", async () => {
    let resolveSave!: (result: SavePersonResult) => void;
    const onSave = jest.fn(() => new Promise<SavePersonResult>((resolve) => { resolveSave = resolve; }));
    const onCancel = jest.fn();
    const conflictingPerson = { ...existing, id: "person-carla", name: "Carla" };
    const editor = (people: SavedPerson[]) => (
      <LocalizationProvider language="en" humour="plain">
        <PersonEditor person={null} people={people} groups={[]} records={[]} onCancel={onCancel} onOpenExisting={jest.fn()} onSave={onSave} />
      </LocalizationProvider>
    );
    const { rerender } = render(editor([]));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    rerender(editor([conflictingPerson]));
    expect(screen.queryByText("A person named Carla already exists.")).toBeNull();

    await act(async () => { resolveSave({ ok: false, reason: "persistence" }); });
    expect(screen.getByText("Could not save settings")).toBeTruthy();
    expect(screen.getByText("A person named Carla already exists.")).toBeTruthy();
    expect(screen.getByText("Edit existing person")).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("offers restoration for an archived name match", () => {
    const archived = { ...existing, archivedAt: "2026-01-10" };
    const onOpenExisting = jest.fn();
    renderEditor({ people: [archived], onOpenExisting });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Ana");

    fireEvent.press(screen.getByText("Restore and edit person"));

    expect(onOpenExisting).toHaveBeenCalledWith(archived, null);
  });

  it("saves the selected existing group with a new person", async () => {
    const onSave = jest.fn(async () => ({ ok: true as const, personId: "person-new" }));
    renderEditor({ onSave });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");
    fireEvent.press(screen.getByText("Roomies"));
    await act(async () => { fireEvent.press(screen.getByText("Save")); });

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      personId: null,
      name: "Carla",
      color: getAvatarTone("Carla").background,
      groupIds: [group.id],
    }));
  });

  it("derives a new person's default avatar color from the entered name", async () => {
    const onSave = jest.fn(async () => ({ ok: true as const, personId: "person-new" }));
    renderEditor({ onSave });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ color: getAvatarTone("Carla").background }));
  });

  it("keeps a last group member selected and allows joining other groups", async () => {
    const anotherGroup: ParticipantGroup = { ...group, id: "group-trip", name: "Trip Crew", memberPersonIds: [] };
    const onSave = jest.fn(async () => ({ ok: true as const, personId: existing.id }));
    renderEditor({ person: existing, people: [existing], groups: [anotherGroup, group], onSave });
    fireEvent.press(screen.getByText("Trip Crew"));
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ personId: existing.id, groupIds: [group.id, anotherGroup.id] }));
  });

  it("rejects an empty name without saving and permits capitalization-only edits", async () => {
    const onSave = jest.fn(async () => ({ ok: true as const, personId: existing.id }));
    renderEditor({ person: existing, people: [existing], onSave });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "  ");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(screen.getByText("Use a unique person name.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "ANA");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "ANA", personId: existing.id }));
  });

  it.each([
    ["A".repeat(26), "Keep participant names under 25 characters."],
    [" yOu ", "Choose a name other than You."],
  ])("shares profile-name validation for %j", async (name, message) => {
    const onSave = jest.fn();
    renderEditor({ onSave });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), name);
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(screen.getByText(message)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a normalized 25-character name without truncation", async () => {
    const onSave = jest.fn(async () => ({ ok: true as const, personId: "person-new" }));
    renderEditor({ onSave });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "  Alexandra   Catherine Smith  ");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Alexandra Catherine Smith" }));
  });

  it("shows the affected split when a rename conflicts with a local participant", async () => {
    const onSave = jest.fn(async () => ({ ok: false as const, reason: "split-name-conflict" as const, recordId: "r1" }));
    render(<LocalizationProvider language="en" humour="plain"><PersonEditor person={existing} people={[existing]} groups={[]} records={[{ id: "r1", values: { splitName: "Lisbon dinner" } } as any]} onCancel={jest.fn()} onOpenExisting={jest.fn()} onSave={onSave} /></LocalizationProvider>);
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Ana Maria");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(screen.getByText(/conflicts with a participant in Lisbon dinner/)).toBeTruthy();
  });

  it.each([
    ["last-group-member", "This person is the last member of a group and cannot be removed from it."],
    ["persistence", "Could not save settings"],
    ["validation", "Use a unique person name."],
  ] as const)("keeps the draft after a %s save result", async (reason, message) => {
    const onSave = jest.fn(async () => ({ ok: false as const, reason } as any));
    renderEditor({ onSave });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByDisplayValue("Carla")).toBeTruthy();
  });

  it("shows group memberships in alphabetical order and prevents removing the final member", () => {
    const trip = { ...group, id: "trip", name: "Trip Crew", memberPersonIds: [] };
    renderEditor({ person: existing, people: [existing], groups: [trip, group] });
    const labels = screen.getAllByText(/Roomies|Trip Crew/).map((node) => node.props.children);
    expect(labels.indexOf("Roomies")).toBeLessThan(labels.indexOf("Trip Crew"));
    expect(screen.getByText("Only member")).toBeTruthy();
  });

  it("persists preset and custom avatar colors", async () => {
    const onSave = jest.fn(async () => ({ ok: true as const, personId: "person-new" }));
    renderEditor({ onSave });
    fireEvent.press(screen.getByLabelText("Select Mint avatar color"));
    fireEvent.press(screen.getByLabelText("Add custom color"));
    fireEvent.press(screen.getByLabelText("Mock color picker"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ color: "#3366cc" }));
  });

  it("offers replacement and removal actions for a saved photo", () => {
    const ImagePicker = require("expo-image-picker");
    renderEditor({ person: { ...existing, photoUri: "file:///owned/ana.jpg" } });
    fireEvent.press(screen.getByLabelText("Choose person photo"));
    expect(screen.getByText("Person photo")).toBeTruthy();
    expect(screen.getByLabelText("Choose photo")).toBeTruthy();
    expect(screen.getByLabelText("Take photo")).toBeTruthy();
    expect(screen.getByLabelText("Remove photo")).toBeTruthy();
    expect(screen.getByLabelText("Cancel")).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("copies a picked photo into owned storage before saving and hides color choices", async () => {
    const ImagePicker = require("expo-image-picker");
    const onSave = jest.fn(async () => ({ ok: true as const, personId: "person-new" }));
    renderEditor({ onSave });
    fireEvent.press(screen.getByLabelText("Choose person photo"));
    await act(async () => { fireEvent.press(screen.getByLabelText("Choose photo")); });
    await waitFor(() => expect(screen.queryByText("Background color")).toBeNull());
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photoUri: "file:///owned/person.jpg" }));
  });

  it("removes a saved photo and returns to the initials and color appearance", async () => {
    const onSave = jest.fn(async () => ({ ok: true as const, personId: existing.id }));
    renderEditor({ person: { ...existing, photoUri: "file:///owned/ana.jpg" }, people: [existing], onSave });
    fireEvent.press(screen.getByLabelText("Choose person photo"));
    fireEvent.press(screen.getByLabelText("Remove photo"));
    expect(screen.getByText("Background color")).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ personId: existing.id, photoUri: null }));
  });

  it("restores an archived person only when the prefilled editor is saved", async () => {
    const archived = { ...existing, archivedAt: "2026-02-01" };
    const onSave = jest.fn(async () => ({ ok: true as const, personId: archived.id }));
    renderEditor({ person: archived, people: [archived], onSave });
    expect(screen.getByText("This person is archived. Saving restores this record.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(screen.getByText("Restore and save")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ personId: archived.id, restore: true, name: archived.name }));
  });

  it("passes an explicitly selected contact photo into duplicate identity handoff", () => {
    const onOpenExisting = jest.fn();
    const duplicate = { ...existing, id: "person-carla", name: "Carla" };
    render(
      <LocalizationProvider language="en" humour="plain">
        <PersonEditor person={existing} people={[existing, duplicate]} groups={[]} records={[]} suggestedContactPhoto="file:///contacts/ana.jpg" onCancel={jest.fn()} onOpenExisting={onOpenExisting} onSave={jest.fn()} />
      </LocalizationProvider>,
    );
    fireEvent.press(screen.getByText("Use photo from this contact"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");
    fireEvent.press(screen.getByText("Edit existing person"));
    expect(onOpenExisting).toHaveBeenCalledWith(duplicate, "file:///contacts/ana.jpg");
  });

  it("imports a selected contact name and photo into the draft without saving early", async () => {
    const onSave = jest.fn(async () => ({ ok: true as const, personId: "person-new" }));
    renderEditor({ onSave });
    fireEvent.press(screen.getByText("Import from contacts"));
    await waitFor(() => expect(screen.getByText("Carla Silva")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Search contacts"), "Daniel");
    expect(screen.getByText("Daniel")).toBeTruthy();
    expect(screen.queryByText("Carla Silva")).toBeNull();
    fireEvent.press(screen.getByLabelText("Back"));
    expect(screen.getByPlaceholderText("e.g. Marcus").props.value).toBe("");
    fireEvent.press(screen.getByText("Import from contacts"));
    await waitFor(() => expect(screen.getByText("Carla Silva")).toBeTruthy());
    fireEvent.press(screen.getByText("Carla Silva"));
    fireEvent.press(screen.getByText("Done"));
    expect(screen.getByDisplayValue("Carla Silva")).toBeTruthy();
    expect(screen.getByText("Contact photo selected")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Carla Silva", photoUri: "file:///owned/carla.jpg" }));
  });

  it("shows a retry action when contacts cannot be loaded", async () => {
    const { loadContacts } = require("../../contacts");
    const Alert = require("react-native").Alert;
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    loadContacts.mockRejectedValueOnce(new Error("contacts unavailable"));
    renderEditor();
    fireEvent.press(screen.getByText("Import from contacts"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Could not load contacts", "Try again or add people by name.", expect.any(Array)));
    const actions = alert.mock.calls.at(-1)?.[2] as Array<{ text: string }>;
    expect(actions.map((action) => action.text)).toEqual(["Try again", "Cancel"]);
    alert.mockRestore();
  });

  it("offers device settings when contacts permission cannot be requested again", async () => {
    const { loadContacts } = require("../../contacts");
    const Alert = require("react-native").Alert;
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    loadContacts.mockImplementationOnce(async () => ({
      Fields: { Name: "name", Image: "image" },
      requestPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
    }));
    renderEditor();
    fireEvent.press(screen.getByText("Import from contacts"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Contacts access unavailable", expect.any(String), expect.any(Array)));
    const actions = alert.mock.calls.at(-1)?.[2] as Array<{ text: string; onPress?: () => void }>;
    expect(actions.map((action) => action.text)).toEqual(["Cancel", "Open settings"]);
    alert.mockRestore();
  });

  it("handles an empty contact book, unmatched searches, and Done without a selection", async () => {
    const { loadContacts } = require("../../contacts");
    loadContacts.mockImplementationOnce(async () => ({
      Fields: { Name: "name", Image: "image" },
      requestPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
      getContactsAsync: async () => ({ data: [] }),
    }));
    renderEditor();

    fireEvent.press(screen.getByText("Import from contacts"));
    await waitFor(() => expect(screen.getByText("No contacts available.")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Back"));
    expect(screen.getByPlaceholderText("e.g. Marcus").props.value).toBe("");

    fireEvent.press(screen.getByText("Import from contacts"));
    await waitFor(() => expect(screen.getByText("Carla Silva")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("Search contacts"), "Nobody here");
    expect(screen.getByText("No matching contacts.")).toBeTruthy();
    fireEvent.press(screen.getByText("Done"));
    expect(screen.getByText("No matching contacts.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Back"));
    expect(screen.getByPlaceholderText("e.g. Marcus").props.value).toBe("");
  });

  it("keeps the photo draft unchanged when picker permission is denied or selection is canceled", async () => {
    const ImagePicker = require("expo-image-picker");
    const Alert = require("react-native").Alert;
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: false });
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true, assets: [] });
    ImagePicker.launchCameraAsync.mockResolvedValueOnce({ canceled: false, assets: [] });
    renderEditor();

    fireEvent.press(screen.getByLabelText("Choose person photo"));
    await act(async () => { fireEvent.press(screen.getByLabelText("Choose photo")); });
    expect(alert).toHaveBeenLastCalledWith("Please allow photo access to choose a profile picture.", "", expect.any(Array));
    expect(screen.getByText("Background color")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Choose person photo"));
    await act(async () => { fireEvent.press(screen.getByLabelText("Take photo")); });
    expect(alert).toHaveBeenLastCalledWith("Please allow camera access to take a profile picture.", "", expect.any(Array));

    fireEvent.press(screen.getByLabelText("Choose person photo"));
    await act(async () => { fireEvent.press(screen.getByLabelText("Choose photo")); });
    fireEvent.press(screen.getByLabelText("Choose person photo"));
    await act(async () => { fireEvent.press(screen.getByLabelText("Take photo")); });
    expect(screen.getByText("Background color")).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it("cleans an owned photo copy after a rejected save and keeps the draft retryable", async () => {
    const { removePersonPhoto } = require("../../personPhotos");
    const onSave = jest.fn().mockRejectedValueOnce(new Error("storage unavailable")).mockResolvedValue({ ok: true, personId: "person-new" });
    renderEditor({ onSave });
    fireEvent.press(screen.getByLabelText("Choose person photo"));
    await act(async () => { fireEvent.press(screen.getByLabelText("Choose photo")); });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");

    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(screen.getByText("Could not save settings")).toBeTruthy();
    expect(screen.getByDisplayValue("Carla")).toBeTruthy();
    expect(removePersonPhoto).toHaveBeenCalledWith("file:///owned/person.jpg");

    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("maps duplicate save results to the existing identity and retries persistence errors", async () => {
    const onOpenExisting = jest.fn();
    const onSave = jest.fn().mockResolvedValueOnce({ ok: false, reason: "duplicate", personId: existing.id }).mockResolvedValue({ ok: false, reason: "persistence" });
    renderEditor({ people: [existing], onOpenExisting, onSave });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(screen.getByText("A person named Ana already exists.")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Another");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(screen.getByDisplayValue("Another")).toBeTruthy();
    expect(onOpenExisting).not.toHaveBeenCalled();
  });
});
