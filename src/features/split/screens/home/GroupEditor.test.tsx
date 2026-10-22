import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { LocalizationProvider } from "../../../../i18n/provider";
import { GroupEditor } from "./GroupEditor";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: "file:///camera/group.jpg" }] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: "file:///library/group.jpg" }] })),
}));
jest.mock("../../contacts", () => ({
  loadContacts: jest.fn(async () => ({
    Fields: { Name: "name" },
    requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    getContactsAsync: jest.fn(async () => ({ data: [
      { id: "contact-1", name: "Maya Patel" },
      { id: "contact-2", name: " Maya   Patel " },
      { id: "contact-3", name: "Nina" },
      { id: "contact-4", name: "" },
    ] })),
  })),
}));
jest.mock("../../groupPhotos", () => ({
  discardTemporaryGroupPhoto: jest.fn(async () => undefined),
  persistGroupPhoto: jest.fn(async (uri: string) => `file:///owned/${uri.split("/").pop()}`),
  removeGroupPhoto: jest.fn(async () => undefined),
}));


describe("GroupEditor", () => {
  it("keeps a new member in the draft until the group is finished", async () => {
    const onSave = jest.fn(async () => true);
    render(
      <LocalizationProvider language="en" humour="plain">
        <GroupEditor group={null} people={[]} allPeople={[]} groups={[]} onCancel={jest.fn()} onSave={onSave} />
      </LocalizationProvider>,
    );
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Roomies"), "Roomies");
    fireEvent.press(screen.getByText("Continue to members"));
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Maya");
    fireEvent.press(screen.getByText("Add “Maya”"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Maya")).toBeTruthy();
    expect(screen.queryByText("Selected members (1)")).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText("Save group"));
    });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: "Roomies",
      newPersonNames: ["Maya"],
      memberPersonIds: [],
    }));
  });

  it("keeps the draft retryable when saving fails", async () => {
    const onSave = jest.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(true);
    render(
      <LocalizationProvider language="en" humour="plain">
        <GroupEditor group={null} people={[]} allPeople={[]} groups={[]} onCancel={jest.fn()} onSave={onSave} />
      </LocalizationProvider>,
    );
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Roomies"), "Roomies");
    fireEvent.press(screen.getByText("Continue to members"));
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Maya");
    fireEvent.press(screen.getByText("Add “Maya”"));

    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(screen.getByText("Could not save settings")).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("hides icon and background controls while a group photo is selected", () => {
    render(
      <LocalizationProvider language="en" humour="plain">
        <GroupEditor
          group={{ id: "g1", name: "Roomies", memberPersonIds: [], usageCount: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01", photoUri: "file:///roomies.jpg" }}
          people={[]}
          allPeople={[]}
          groups={[]}
          onCancel={jest.fn()}
          onSave={jest.fn(async () => true)}
        />
      </LocalizationProvider>,
    );

    expect(screen.queryByText("Choose an icon")).toBeNull();
    expect(screen.queryByText("Background color")).toBeNull();
  });

  it("saves a custom background color selected with the color wheel", async () => {
    const onSave = jest.fn(async () => true);
    render(
      <LocalizationProvider language="en" humour="plain">
        <GroupEditor group={null} people={[]} allPeople={[]} groups={[]} onCancel={jest.fn()} onSave={onSave} />
      </LocalizationProvider>,
    );
    fireEvent.press(screen.getByLabelText("Add custom color"));
    fireEvent.press(screen.getByLabelText("Mock color picker"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Roomies"), "Roomies");
    fireEvent.press(screen.getByText("Continue to members"));
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Maya");
    fireEvent.press(screen.getByText("Add “Maya”"));

    await act(async () => {
      fireEvent.press(screen.getByText("Save group"));
    });

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ color: "#3366cc" }));
  });

  it("shows search results as add actions and removes selected people from the counted roster", () => {
    const maya = { id: "p1", name: "Maya Patel", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    render(
      <LocalizationProvider language="en" humour="plain">
        <GroupEditor group={null} people={[maya]} allPeople={[maya]} groups={[]} onCancel={jest.fn()} onSave={jest.fn(async () => true)} />
      </LocalizationProvider>,
    );
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Roomies"), "Roomies");
    fireEvent.press(screen.getByText("Continue to members"));

    expect(screen.getByText("Members in Group (0)")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Type a new person's name")).toBeNull();
    expect(screen.getByText("Import from contacts")).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Maya");
    fireEvent.press(screen.getByLabelText("Add Maya Patel to group"));
    expect(screen.getByText("Members in Group (1)")).toBeTruthy();
    expect(screen.getByLabelText("Remove Maya Patel from group")).toBeTruthy();
    expect(screen.queryByLabelText("Add Maya Patel to group")).toBeNull();

    fireEvent.press(screen.getByLabelText("Remove Maya Patel from group"));
    expect(screen.getByText("Members in Group (0)")).toBeTruthy();
  });

  it("keeps archived members in the roster until removed", () => {
    const archived = { id: "p-archived", name: "Zoe Archived", archivedAt: "2026-02-01", createdAt: "2026-01-01", updatedAt: "2026-02-01" };
    render(
      <LocalizationProvider language="en" humour="plain">
        <GroupEditor
          group={{ id: "g1", name: "Roomies", memberPersonIds: [archived.id], usageCount: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01" }}
          people={[]}
          allPeople={[archived]}
          groups={[]}
          onCancel={jest.fn()}
          onSave={jest.fn(async () => true)}
        />
      </LocalizationProvider>,
    );
    fireEvent.press(screen.getByText("Continue to members"));

    expect(screen.getByText("Members in Group (1)")).toBeTruthy();
    expect(screen.getByText("Archived")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Remove Zoe Archived from group"));
    expect(screen.getByText("Members in Group (0)")).toBeTruthy();
  });

  it("marks an archived name as a staged restore when adding it to a group", async () => {
    const archived = { id: "p-archived", name: "Zoe Archived", archivedAt: "2026-02-01", createdAt: "2026-01-01", updatedAt: "2026-02-01" };
    const onSave = jest.fn(async () => true);
    render(
      <LocalizationProvider language="en" humour="plain">
        <GroupEditor group={null} people={[]} allPeople={[archived]} groups={[]} onCancel={jest.fn()} onSave={onSave} />
      </LocalizationProvider>,
    );
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Roomies"), "Roomies");
    fireEvent.press(screen.getByText("Continue to members"));
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Zoe Archived");

    expect(screen.getByLabelText("Add and restore “Zoe Archived”")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Add and restore “Zoe Archived”"));
    expect(screen.getByText("Will restore archived person")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ newPersonNames: ["Zoe Archived"] }));
  });

  it("validates a blank or duplicate group name before advancing", () => {
    const groups = [{ id: "g1", name: "Roomies", memberPersonIds: [], usageCount: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01" }];
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={null} people={[]} allPeople={[]} groups={groups} onCancel={jest.fn()} onSave={jest.fn(async () => true)} /></LocalizationProvider>);
    fireEvent.press(screen.getByText("Continue to members"));
    expect(screen.getByText("Add a unique group name and at least one member.")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Roomies"), " roomies ");
    fireEvent.press(screen.getByText("Continue to members"));
    expect(screen.getByText("Add a unique group name and at least one member.")).toBeTruthy();
    expect(screen.queryByText("Add people who often split expenses in this group.")).toBeNull();
  });

  it("preserves edit details across both steps and saves without replacing the group identity", async () => {
    const onSave = jest.fn(async () => true);
    const group = { id: "g-edit", name: "Old name", description: "A description", memberPersonIds: ["p1"], usageCount: 7, createdAt: "2025-01-01", updatedAt: "2026-01-01", color: "mint" as const, icon: "plane" as const };
    const person = { id: "p1", name: "Ana", createdAt: "2025-01-01", updatedAt: "2025-01-01" };
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={group} people={[person]} allPeople={[person]} groups={[group]} onCancel={jest.fn()} onSave={onSave} /></LocalizationProvider>);
    fireEvent.changeText(screen.getByDisplayValue("Old name"), "Weekend crew");
    fireEvent.press(screen.getByText("Continue to members"));
    expect(screen.getByText("Weekend crew")).toBeTruthy();
    expect(screen.getByText("Members in Group (1)")).toBeTruthy();
    fireEvent.press(screen.getByText("Back to group details"));
    expect(screen.getByDisplayValue("Weekend crew")).toBeTruthy();
    fireEvent.press(screen.getByText("Continue to members"));
    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Weekend crew", description: "A description", memberPersonIds: ["p1"], color: "mint", icon: "plane" }));
  });

  it("adds saved people once and removes either saved or draft members", () => {
    const ana = { id: "p1", name: "Ana", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={null} people={[ana]} allPeople={[ana]} groups={[]} initialStep={2} onCancel={jest.fn()} onSave={jest.fn(async () => true)} /></LocalizationProvider>);
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "ana");
    fireEvent.press(screen.getByLabelText("Add Ana to group"));
    expect(screen.getByText("Members in Group (1)")).toBeTruthy();
    expect(screen.queryByLabelText("Add Ana to group")).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Mina");
    fireEvent.press(screen.getByText("Add “Mina”"));
    fireEvent.press(screen.getByLabelText("Remove Mina from group"));
    expect(screen.getByText("Members in Group (1)")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Remove Ana from group"));
    expect(screen.getByText("Members in Group (0)")).toBeTruthy();
  });

  it("allows retry after a rejected group save and rejects a memberless group", async () => {
    const onSave = jest.fn(async () => true);
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={null} people={[]} allPeople={[]} groups={[]} initialStep={2} onCancel={jest.fn()} onSave={onSave} /></LocalizationProvider>);
    fireEvent.press(screen.getByText("Save group"));
    expect(screen.getByText("Add a unique group name and at least one member.")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Mina");
    fireEvent.press(screen.getByText("Add “Mina”"));
    onSave.mockRejectedValueOnce(new Error("storage unavailable"));
    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(screen.getByText("Could not save settings")).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("imports selected contacts, deduplicates names, and reuses matching saved people", async () => {
    const maya = { id: "saved-maya", name: "Maya Patel", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const onSave = jest.fn(async () => true);
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={null} people={[maya]} allPeople={[maya]} groups={[]} initialStep={2} onCancel={jest.fn()} onSave={onSave} /></LocalizationProvider>);
    fireEvent.press(screen.getByLabelText("Import from contacts"));
    await waitFor(() => expect(screen.getAllByText("Maya Patel").length).toBe(2));
    fireEvent.changeText(screen.getByPlaceholderText("Search by name"), "Nina");
    expect(screen.getByText("Nina")).toBeTruthy();
    expect(screen.queryByText("Maya Patel")).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText("Search by name"), "");
    fireEvent.press(screen.getAllByText("Maya Patel")[0]);
    fireEvent.press(screen.getAllByText("Maya Patel")[1]);
    fireEvent.press(screen.getByText("Nina"));
    fireEvent.press(screen.getByText("Done"));
    expect(screen.getByText("Members in Group (2)")).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ memberPersonIds: [maya.id], newPersonNames: ["Nina"] }));
  });

  it("offers manual name entry when permission is denied and reports contact service failures", async () => {
    const { loadContacts } = require("../../contacts");
    const alert = jest.spyOn(require("react-native").Alert, "alert").mockImplementation(() => undefined);
    loadContacts.mockImplementationOnce(async () => ({
      Fields: { Name: "name" },
      requestPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
    }));
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={null} people={[]} allPeople={[]} groups={[]} initialStep={2} onCancel={jest.fn()} onSave={jest.fn(async () => true)} /></LocalizationProvider>);
    fireEvent.press(screen.getByLabelText("Import from contacts"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Contacts access unavailable", expect.any(String), expect.any(Array)));
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Mina");
    fireEvent.press(screen.getByText("Add “Mina”"));
    expect(screen.getByText("Members in Group (1)")).toBeTruthy();
    alert.mockRestore();

    const secondAlert = jest.spyOn(require("react-native").Alert, "alert").mockImplementation(() => undefined);
    loadContacts.mockRejectedValueOnce(new Error("contacts unavailable"));
    fireEvent.press(screen.getByLabelText("Import from contacts"));
    await waitFor(() => expect(secondAlert).toHaveBeenCalledWith("Could not load contacts", expect.any(String)));
    secondAlert.mockRestore();
  });

  it("keeps manual entry available after retryable contact denial and handles an empty contact book", async () => {
    const { loadContacts } = require("../../contacts");
    const alert = jest.spyOn(require("react-native").Alert, "alert").mockImplementation(() => undefined);
    loadContacts.mockImplementationOnce(async () => ({
      Fields: { Name: "name" },
      requestPermissionsAsync: async () => ({ granted: false, canAskAgain: true }),
    }));
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={null} people={[]} allPeople={[]} groups={[]} initialStep={2} onCancel={jest.fn()} onSave={jest.fn(async () => true)} /></LocalizationProvider>);

    fireEvent.press(screen.getByLabelText("Import from contacts"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Contacts access unavailable", expect.any(String), [{ text: "Okay" }]));
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Mina");
    fireEvent.press(screen.getByText("Add “Mina”"));
    expect(screen.getByText("Members in Group (1)")).toBeTruthy();

    loadContacts.mockImplementationOnce(async () => ({
      Fields: { Name: "name" },
      requestPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
      getContactsAsync: async () => ({ data: [] }),
    }));
    fireEvent.press(screen.getByLabelText("Import from contacts"));
    await waitFor(() => expect(screen.getByText("No contacts available. Add people by name instead.")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Back"));
    expect(screen.getByText("Members in Group (1)")).toBeTruthy();
    expect(screen.getByText("Mina")).toBeTruthy();
    alert.mockRestore();
  });

  it("uses the emoji picker and validates custom picker colors", () => {
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={null} people={[]} allPeople={[]} groups={[]} onCancel={jest.fn()} onSave={jest.fn(async () => true)} /></LocalizationProvider>);
    fireEvent.press(screen.getByText("+"));
    fireEvent.press(screen.getByLabelText("Mock system emoji picker"));
    expect(screen.getAllByText("💳").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText("Add custom color"));
    fireEvent.press(screen.getByLabelText("Mock color picker"));
    expect(screen.getByLabelText("Add custom color")).toBeTruthy();
  });

  it("replaces a group icon with a picked photo and restores appearance controls when removed", async () => {
    const ImagePicker = require("expo-image-picker");
    const Alert = require("react-native").Alert;
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const onSave = jest.fn(async () => true);
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={null} people={[]} allPeople={[]} groups={[]} onCancel={jest.fn()} onSave={onSave} /></LocalizationProvider>);
    fireEvent.press(screen.getByLabelText("Choose group photo"));
    const photoOptions = alert.mock.calls.at(-1)?.[2] as Array<{ text: string; onPress?: () => void }>;
    await act(async () => { photoOptions.find((option) => option.text === "Photo library")?.onPress?.(); await Promise.resolve(); });
    await waitFor(() => expect(screen.queryByText("Choose an icon")).toBeNull());
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));

    fireEvent.press(screen.getByLabelText("Choose group photo"));
    const replacementOptions = alert.mock.calls.at(-1)?.[2] as Array<{ text: string; onPress?: () => void }>;
    act(() => replacementOptions.find((option) => option.text === "Remove photo")?.onPress?.());
    expect(screen.getByText("Choose an icon")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Roomies"), "Roomies");
    fireEvent.press(screen.getByText("Continue to members"));
    fireEvent.changeText(screen.getByPlaceholderText("Search or add people"), "Maya");
    fireEvent.press(screen.getByText("Add “Maya”"));
    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photoUri: null }));
    alert.mockRestore();
  });

  it("leaves the group draft unchanged when photo access is denied", async () => {
    const ImagePicker = require("expo-image-picker");
    const Alert = require("react-native").Alert;
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    ImagePicker.launchImageLibraryAsync.mockClear();
    ImagePicker.requestMediaLibraryPermissionsAsync.mockImplementationOnce(async () => ({ granted: false }));
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={null} people={[]} allPeople={[]} groups={[]} onCancel={jest.fn()} onSave={jest.fn(async () => true)} /></LocalizationProvider>);
    fireEvent.press(screen.getByLabelText("Choose group photo"));
    const options = alert.mock.calls.at(-1)?.[2] as Array<{ text: string; onPress?: () => void }>;
    await act(async () => { options.find((option) => option.text === "Photo library")?.onPress?.(); await Promise.resolve(); });
    expect(screen.getByText("Choose an icon")).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it("cleans only a replacement photo copy after save failure and removes the old photo after retry succeeds", async () => {
    const Alert = require("react-native").Alert;
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const { removeGroupPhoto } = require("../../groupPhotos");
    const member = { id: "p1", name: "Ana", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const group = { id: "g1", name: "Roomies", memberPersonIds: [member.id], usageCount: 2, createdAt: "2025-01-01", updatedAt: "2026-01-01", photoUri: "file:///owned/previous.jpg" };
    const onSave = jest.fn().mockRejectedValueOnce(new Error("storage unavailable")).mockResolvedValue(true);
    render(<LocalizationProvider language="en" humour="plain"><GroupEditor group={group} people={[member]} allPeople={[member]} groups={[group]} onCancel={jest.fn()} onSave={onSave} /></LocalizationProvider>);

    fireEvent.press(screen.getByLabelText("Choose group photo"));
    const options = alert.mock.calls.at(-1)?.[2] as Array<{ text: string; onPress?: () => void }>;
    await act(async () => { options.find((option) => option.text === "Photo library")?.onPress?.(); });
    fireEvent.press(screen.getByText("Continue to members"));

    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(screen.getByText("Could not save settings")).toBeTruthy();
    expect(removeGroupPhoto).toHaveBeenCalledWith("file:///owned/group.jpg");
    expect(removeGroupPhoto).not.toHaveBeenCalledWith(group.photoUri);

    await act(async () => { fireEvent.press(screen.getByText("Save group")); });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(removeGroupPhoto).toHaveBeenCalledWith(group.photoUri);
    alert.mockRestore();
  });
});
