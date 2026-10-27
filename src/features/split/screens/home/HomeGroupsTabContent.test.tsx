import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { LocalizationProvider } from "../../../../i18n/provider";
import type { AppSettings } from "../../../../storage/settings";
import { HomeGroupsTabContent } from "./HomeGroupsTabContent";

const group = {
  id: "group-roomies",
  name: "Roomies",
  memberPersonIds: [],
  usageCount: 0,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const settings: AppSettings = {
  ownerName: "You",
  ownerProfileImageUri: "",
  balanceFeatureEnabled: true,
  trackPaymentsFeatureEnabled: true,
  defaultCurrency: "EUR",
  language: "en",
  humour: "plain",
  splitListAmountDisplay: "remaining",
  customCurrencies: [],
  people: [],
  participantGroups: [group],
};

function renderDirectory(
  onRemoveGroup = jest.fn(async () => undefined),
  directorySettings = settings,
  getDeletionImpact = jest.fn(() => ({ used: false, splitCount: 0, groupCount: 0 })),
  handlers: {
    onSavePerson?: jest.Mock;
    onRemovePerson?: jest.Mock;
    onAddGroup?: jest.Mock;
    onUpdateGroup?: jest.Mock;
    onUpdateSettings?: jest.Mock;
  } = {},
) {
  const onSavePerson = handlers.onSavePerson ?? jest.fn(async () => ({ ok: true as const, personId: "person-new" }));
  const onRemovePerson = handlers.onRemovePerson ?? jest.fn(async () => "deleted" as const);
  const onAddGroup = handlers.onAddGroup ?? jest.fn(async () => true);
  const onUpdateGroup = handlers.onUpdateGroup ?? jest.fn(async () => true);
  const onUpdateSettings = handlers.onUpdateSettings ?? jest.fn(async () => undefined);
  return {
    onRemoveGroup,
    onSavePerson,
    onRemovePerson,
    onAddGroup,
    onUpdateGroup,
    onUpdateSettings,
    ...render(
      <LocalizationProvider language="en" humour="plain">
        <HomeGroupsTabContent
          topInset={0}
          footerInsetBottom={0}
          settings={directorySettings}
          records={[]}
          onSavePerson={onSavePerson}
          onUpdateSettings={onUpdateSettings}
          onGetPersonDeletionImpact={getDeletionImpact}
          onRemovePerson={onRemovePerson}
          onAddGroup={onAddGroup}
          onUpdateGroup={onUpdateGroup}
          onRemoveGroup={onRemoveGroup}
        />
      </LocalizationProvider>,
    ),
  };
}

function renderGroupsDirectory(...args: Parameters<typeof renderDirectory>) {
  const result = renderDirectory(...args);
  fireEvent.press(result.getByRole("button", { name: /^Groups \(/ }));
  return result;
}

describe("HomeGroupsTabContent group actions", () => {
  it("opens People by default with People on the left and Groups on the right", () => {
    renderDirectory();
    expect(screen.getByText("People (1)")).toBeTruthy();
    const tabs = screen.getAllByRole("button").slice(0, 2);
    expect(within(tabs[0]).getByText("People (1)")).toBeTruthy();
    expect(tabs[0].props.accessibilityState.selected).toBe(true);
    expect(within(tabs[1]).getByText("Groups (1)")).toBeTruthy();
    expect(tabs[1].props.accessibilityState.selected).toBe(false);
    expect(screen.getByText("Your profile")).toBeTruthy();
    expect(screen.getByText("Active (1)")).toBeTruthy();
    expect(screen.getByText("No other people saved yet")).toBeTruthy();
    expect(screen.getByText("Add people you split with often to find them easily next time.")).toBeTruthy();
    expect(screen.queryByLabelText("Open actions for Roomies")).toBeNull();
  });

  it("opens group details from the menu", () => {
    renderGroupsDirectory();

    fireEvent.press(screen.getByLabelText("Open actions for Roomies"));
    fireEvent.press(screen.getByText("Edit details"));

    expect(screen.getByText("Group details")).toBeTruthy();
    expect(screen.getByText("STEP 1 OF 2")).toBeTruthy();
  });

  it("opens group members from the menu", () => {
    renderGroupsDirectory();

    fireEvent.press(screen.getByLabelText("Open actions for Roomies"));
    fireEvent.press(screen.getByText("Edit members"));

    expect(screen.getByText("Add group members")).toBeTruthy();
    expect(screen.getByText("STEP 2 OF 2")).toBeTruthy();
  });

  it("opens the same actions from a long press without opening the editor", () => {
    renderGroupsDirectory();
    const groupTile = screen.getByLabelText("Roomies");

    fireEvent(groupTile, "longPress");
    fireEvent.press(groupTile);

    expect(screen.getByText("Group actions")).toBeTruthy();
    expect(screen.getByText("Edit details")).toBeTruthy();
    expect(screen.getByText("Edit members")).toBeTruthy();
    expect(screen.getByText("Delete group")).toBeTruthy();
  });

  it("clears the long-press guard when the group action sheet is dismissed", () => {
    renderGroupsDirectory();
    const groupTile = screen.getByLabelText("Roomies");
    fireEvent(groupTile, "longPress");
    fireEvent.press(screen.getByLabelText("Dismiss action sheet"));
    fireEvent.press(groupTile);

    expect(screen.getByText("Group details")).toBeTruthy();
  });

  it("confirms deletion and removes only the selected group", () => {
    const onRemoveGroup = jest.fn(async () => undefined);
    renderGroupsDirectory(onRemoveGroup);

    fireEvent.press(screen.getByLabelText("Open actions for Roomies"));
    fireEvent.press(screen.getByText("Delete group"));

    expect(screen.getByText("Delete group?")).toBeTruthy();
    expect(screen.getByText("Delete Roomies? Its people and existing split history will remain unchanged.")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    expect(onRemoveGroup).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText("Open actions for Roomies"));
    fireEvent.press(screen.getByText("Delete group"));
    act(() => fireEvent.press(screen.getByLabelText("Delete group")));
    expect(onRemoveGroup).toHaveBeenCalledWith(group.id);
  });

  it("shows people tiles with only their avatar, name, and actions", () => {
    const person = { id: "person-ana", name: "Ana", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const directorySettings = { ...settings, people: [person], participantGroups: [{ ...group, memberPersonIds: [person.id] }] };
    renderDirectory(undefined, directorySettings);

    fireEvent.press(screen.getByText("People (2)"));

    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("Roomies")).toBeNull();
    expect(screen.getByLabelText("Open actions for Ana")).toBeTruthy();
  });

  it("opens the person actions on long press and explains archiving on delete", () => {
    const person = { id: "person-ana", name: "Ana", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const directorySettings = { ...settings, people: [person], participantGroups: [{ ...group, memberPersonIds: [person.id] }] };
    renderDirectory(undefined, directorySettings, jest.fn(() => ({ used: true, splitCount: 0, groupCount: 1 })));
    fireEvent.press(screen.getByText("People (2)"));
    fireEvent(screen.getByLabelText("Edit person Ana"), "longPress");

    expect(screen.getByText("Ana options")).toBeTruthy();
    expect(screen.getByText("Edit person")).toBeTruthy();
    expect(screen.getByText("Archive person")).toBeTruthy();
    fireEvent.press(screen.getByText("Archive person"));
    expect(screen.getByText("Archive person?")).toBeTruthy();
    expect(screen.getByText("Archive Ana? They will leave your active people list, while existing groups and split history stay intact.")).toBeTruthy();
  });

  it("creates a group with a new member through the directory action", async () => {
    const onAddGroup = jest.fn(async () => true);
    renderGroupsDirectory(undefined, settings, undefined, { onAddGroup });
    fireEvent.press(screen.getByLabelText("Add group"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Roomies"), "Lisbon crew");
    fireEvent.press(screen.getByText("Continue to members"));
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Maya");
    fireEvent.press(screen.getByText("Add “Maya”"));
    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(onAddGroup).toHaveBeenCalledWith("Lisbon crew", [], expect.objectContaining({ name: "Lisbon crew" }), ["Maya"]);
    expect(screen.getByText("People (1)")).toBeTruthy();
  });

  it("creates a person from the People tab and persists the selected group membership", async () => {
    const onSavePerson = jest.fn(async () => ({ ok: true as const, personId: "person-new" }));
    renderDirectory(undefined, settings, undefined, { onSavePerson });
    fireEvent.press(screen.getByText("People (1)"));
    fireEvent.press(screen.getByText("Add person"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Carla");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(onSavePerson).toHaveBeenCalledWith(expect.objectContaining({ name: "Carla", personId: null, groupIds: [] }));
    expect(screen.getByText("People (1)")).toBeTruthy();
  });

  it("opens group member editing directly from a member avatar and overflow control", () => {
    const people = ["Ana", "Bruno", "Carla", "Daniel", "Eva"].map((name, index) => ({ id: `p${index}`, name, createdAt: "2026-01-01", updatedAt: "2026-01-01" }));
    const directorySettings = { ...settings, people, participantGroups: [{ ...group, memberPersonIds: people.map((person) => person.id) }] };
    renderGroupsDirectory(undefined, directorySettings);
    fireEvent.press(screen.getByLabelText("Ana, edit members of Roomies"));
    expect(screen.getByText("STEP 2 OF 2")).toBeTruthy();
  });

  it("restores an archived person only after saving the prefilled editor", async () => {
    const archived = { id: "person-old", name: "Ana", archivedAt: "2026-02-01", createdAt: "2026-01-01", updatedAt: "2026-02-01" };
    const onSavePerson = jest.fn(async () => ({ ok: true as const, personId: archived.id }));
    const directorySettings = { ...settings, people: [archived] };
    renderDirectory(undefined, directorySettings, undefined, { onSavePerson });
    fireEvent.press(screen.getByText("People (1)"));
    fireEvent.press(screen.getByText("Archived (1)"));
    fireEvent.press(screen.getByLabelText("Open actions for Ana"));
    fireEvent.press(screen.getByText("Restore person"));
    expect(screen.getByDisplayValue("Ana")).toBeTruthy();
    expect(onSavePerson).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(screen.getByText("Restore and save")); });
    expect(onSavePerson).toHaveBeenCalledWith(expect.objectContaining({ personId: archived.id, restore: true, name: "Ana" }));
  });

  it("keeps the deletion confirmation available after storage failure and retries", async () => {
    const onRemoveGroup = jest.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
    renderGroupsDirectory(onRemoveGroup);
    fireEvent.press(screen.getByLabelText("Open actions for Roomies"));
    fireEvent.press(screen.getByText("Delete group"));
    await act(async () => { fireEvent.press(screen.getByLabelText("Delete group")); });
    expect(screen.getByText(/Could not save settings/)).toBeTruthy();
    expect(screen.getByText("Delete group?")).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText("Delete group")); });
    expect(onRemoveGroup).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Could not save settings/)).toBeNull();
    fireEvent.press(screen.getByLabelText("Open actions for Roomies"));
    fireEvent.press(screen.getByText("Delete group"));
    expect(screen.queryByText(/Could not save settings/)).toBeNull();
    fireEvent.press(screen.getByLabelText("Cancel"));
  });

  it("filters archived people and allows deleting an unused person permanently", async () => {
    const person = { id: "person-ana", name: "Ana", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const onRemovePerson = jest.fn(async () => "deleted" as const);
    renderDirectory(undefined, { ...settings, people: [person] }, undefined, { onRemovePerson });
    fireEvent.press(screen.getByText("People (2)"));
    fireEvent.press(screen.getByText("Archived (0)"));
    expect(screen.getByText("No archived people.")).toBeTruthy();
    fireEvent.press(screen.getByText("Active (2)"));
    fireEvent.changeText(screen.getByPlaceholderText("Search people..."), "No match");
    expect(screen.getByText("No people match your search.")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("Search people..."), "");
    fireEvent.press(screen.getByLabelText("Open actions for Ana"));
    fireEvent.press(screen.getByText("Delete person"));
    expect(screen.getByText("Delete Ana permanently? This person is not used in any group or split.")).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText("Delete person")); });
    expect(onRemovePerson).toHaveBeenCalledWith(person.id);
  });

  it("shows a useful group search empty state and an empty directory state", () => {
    renderGroupsDirectory();
    fireEvent.changeText(screen.getByPlaceholderText("Search groups..."), "missing crew");
    expect(screen.getByText("No groups match your search.")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("Search groups..."), "");
    expect(screen.getByText("Roomies")).toBeTruthy();

    const emptySettings = { ...settings, participantGroups: [] };
    renderGroupsDirectory(undefined, emptySettings);
    expect(screen.getByText("No groups yet")).toBeTruthy();
  });

  it("offers restore and permanent delete for an unused archived person", async () => {
    const archived = { id: "person-archived", name: "Nina", archivedAt: "2026-02-01", createdAt: "2026-01-01", updatedAt: "2026-02-01" };
    const onRemovePerson = jest.fn(async () => "deleted" as const);
    const getImpact = jest.fn(() => ({ used: false, splitCount: 0, groupCount: 0 }));
    renderDirectory(undefined, { ...settings, people: [archived] }, getImpact, { onRemovePerson });
    fireEvent.press(screen.getByText("People (1)"));
    fireEvent.press(screen.getByText("Archived (1)"));
    fireEvent.press(screen.getByLabelText("Open actions for Nina"));
    expect(screen.getByText("Restore person")).toBeTruthy();
    expect(screen.getByText("Delete person")).toBeTruthy();
    fireEvent.press(screen.getByText("Delete person"));
    expect(screen.getByText("Delete Nina permanently? This person is not used in any group or split.")).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText("Delete person")); });
    expect(onRemovePerson).toHaveBeenCalledWith(archived.id);
    expect(getImpact).toHaveBeenCalledWith(archived.id);
  });

  it("hides permanent deletion for an archived person still referenced by a group", () => {
    const archived = { id: "person-archived", name: "Nina", archivedAt: "2026-02-01", createdAt: "2026-01-01", updatedAt: "2026-02-01" };
    const directorySettings = { ...settings, people: [archived], participantGroups: [{ ...group, memberPersonIds: [archived.id] }] };
    renderDirectory(undefined, directorySettings, jest.fn(() => ({ used: true, splitCount: 0, groupCount: 1 })));
    fireEvent.press(screen.getByText("People (1)"));
    fireEvent.press(screen.getByText("Archived (1)"));
    fireEvent.press(screen.getByLabelText("Open actions for Nina"));
    expect(screen.getByText("Restore person")).toBeTruthy();
    expect(screen.queryByText("Delete person")).toBeNull();
  });

  it("retains person deletion confirmation after failure and retries the same identity", async () => {
    const person = { id: "person-ana", name: "Ana", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const onRemovePerson = jest.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue("archived");
    renderDirectory(undefined, { ...settings, people: [person] }, jest.fn(() => ({ used: true, splitCount: 1, groupCount: 0 })), { onRemovePerson });
    fireEvent.press(screen.getByText("People (2)"));
    fireEvent.press(screen.getByLabelText("Open actions for Ana"));
    fireEvent.press(screen.getByText("Archive person"));
    await act(async () => { fireEvent.press(screen.getByLabelText("Archive person")); });
    expect(screen.getByText(/Could not save settings/)).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText("Archive person")); });
    expect(onRemovePerson).toHaveBeenCalledTimes(2);
    expect(onRemovePerson).toHaveBeenNthCalledWith(1, person.id);
    expect(onRemovePerson).toHaveBeenNthCalledWith(2, person.id);
  });

  it("excludes the owner's global person from the People directory", () => {
    const owner = { id: "owner", name: "You", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const other = { id: "person-other", name: "Ana", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    renderDirectory(undefined, { ...settings, ownerPersonId: owner.id, people: [owner, other] });
    fireEvent.press(screen.getByText("People (2)"));
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Your profile")).toBeTruthy();
    expect(screen.getAllByText("You")).toHaveLength(1);
  });

  it("shows the owner first and opens a profile-only editor", async () => {
    const owner = { id: "owner", name: "Alice", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const other = { id: "person-other", name: "Ana", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const onUpdateSettings = jest.fn(async () => undefined);
    renderDirectory(undefined, { ...settings, ownerName: "Alice", ownerPersonId: owner.id, people: [owner, other] }, undefined, { onUpdateSettings });
    fireEvent.press(screen.getByText("People (2)"));
    expect(screen.getByText("Your profile")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    const labels = screen.getAllByRole("button").map((button: any) => button.props.accessibilityLabel);
    expect(labels.indexOf("Your profile")).toBeLessThan(labels.indexOf("Edit person Ana"));
    fireEvent.press(screen.getByLabelText("Your profile"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Marcus"), "Alex");
    await act(async () => { fireEvent.press(screen.getByText("Save")); });
    expect(onUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ ownerName: "Alex", ownerProfileImageUri: "" }));
  });
});
