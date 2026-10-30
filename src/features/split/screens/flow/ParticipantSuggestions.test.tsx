import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { LocalizationProvider } from "../../../../i18n/provider";
import type { DraftRecord } from "../../../../storage/records";
import type { AppSettings } from "../../../../storage/settings";
import { ParticipantSuggestions } from "./ParticipantSuggestions";

const people = ["Ana", "David", "Maya", "Sarah", "Lee", "You"].map((name) => ({
  id: name.toLowerCase(),
  name,
  createdAt: "now",
  updatedAt: "now",
}));
const settings = {
  ownerName: "You",
  ownerPersonId: "you",
  people: [
    ...people,
    {
      id: "archived",
      name: "Archived",
      archivedAt: "now",
      createdAt: "now",
      updatedAt: "now",
    },
  ],
  participantGroups: [
    {
      id: "roomies",
      name: "Roomies",
      memberPersonIds: ["sarah", "david", "ana", "maya", "archived"],
      usageCount: 2,
      createdAt: "now",
      updatedAt: "now",
    },
    {
      id: "trip",
      name: "Trip Crew",
      memberPersonIds: ["lee", "ana"],
      usageCount: 1,
      createdAt: "now",
      updatedAt: "now",
    },
  ],
} as AppSettings;
const record = {
  id: "current",
  values: {
    participants: [
      { id: "owner-local", personId: "you", name: "You" },
      { id: "david-local", personId: "david", name: "David" },
    ],
  },
} as DraftRecord;
const history = {
  id: "history",
  values: {
    participants: people.map((person) => ({
      id: person.id,
      personId: person.id,
      name: person.name,
    })),
  },
} as DraftRecord;

function view(
  current = record,
  onAddGroup = jest.fn(async () => undefined),
  appSettings = settings,
  language: "en" | "pt" = "en",
  sourceRecords: DraftRecord[] = [history, current],
) {
  return (
    <LocalizationProvider language={language} humour="plain">
      <ParticipantSuggestions
        records={sourceRecords}
        record={current}
        settings={appSettings}
        onAddFriend={jest.fn()}
        onAddGroup={onAddGroup}
      />
    </LocalizationProvider>
  );
}

describe("participant suggestion modes", () => {
  it("distinguishes when no frequent people exist yet", () => {
    render(view(record, undefined, settings, "en", []));
    expect(screen.getByText("No frequent people yet")).toBeTruthy();
    expect(
      screen.getByText(
        "People from past splits will appear here as you keep creating splits.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("frequent-empty-icon-new")).toBeTruthy();
  });

  it("explains when every frequent person is already in the split", () => {
    const allAdded = {
      ...record,
      values: {
        ...record.values,
        participants: people.map((person) => ({
          id: `${person.id}-current`,
          personId: person.id,
          name: person.name,
        })),
      },
    };
    render(view(allAdded));
    expect(screen.getByText("All your regulars are added")).toBeTruthy();
    expect(
      screen.getByText(
        "Need someone else? Search or add them below.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("frequent-empty-icon-complete")).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId("frequent-empty-card").props.style),
    ).toMatchObject({
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 20,
    });
  });

  it("keeps frequent people separate from groups and excludes already-added and archived people", () => {
    render(view());
    expect(
      screen.getByRole("tab", { name: "Frequent" }).props.accessibilityState
        .selected,
    ).toBe(true);
    expect(screen.getByLabelText("Add frequent friend Ana")).toBeTruthy();
    expect(screen.queryByLabelText("Add frequent friend David")).toBeNull();
    expect(screen.queryByLabelText("Add frequent friend You")).toBeNull();
    expect(screen.queryByText("Roomies")).toBeNull();
    fireEvent.press(screen.getByRole("tab", { name: "Groups" }));
    expect(screen.getByText("1 of 4 added")).toBeTruthy();
    expect(screen.queryByLabelText("Add frequent friend Ana")).toBeNull();
    expect(screen.queryByText("Archived")).toBeNull();
    expect(
      screen.getByLabelText("David already added from Roomies"),
    ).toBeDisabled();
  });

  it("hides an unlinked frequent candidate when a linked current participant has the same name", () => {
    const legacyHistory = {
      ...history,
      values: {
        ...history.values,
        participants: history.values.participants.map((participant) =>
          participant.name === "David"
            ? { id: "legacy-david", name: "David" }
            : participant,
        ),
      },
    } as DraftRecord;
    const linkedCurrent = {
      ...record,
      values: {
        ...record.values,
        participants: [
          { id: "owner-local", personId: "you", name: "You" },
          { id: "david-local", personId: "david", name: " David " },
        ],
      },
    } as DraftRecord;

    render(view(linkedCurrent, undefined, settings, "en", [legacyHistory, linkedCurrent]));

    expect(screen.queryByLabelText("Add frequent friend David")).toBeNull();
  });

  it("adds individually, sorts missing before added members, and adds only remaining members", async () => {
    const onAddGroup = jest.fn(async () => undefined);
    const { rerender } = render(view(record, onAddGroup));
    fireEvent.press(screen.getByRole("tab", { name: "Groups" }));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add Ana from Roomies"));
    });
    expect(onAddGroup).toHaveBeenLastCalledWith("roomies", ["ana"]);
    const updated = {
      ...record,
      values: {
        ...record.values,
        participants: [
          ...record.values.participants,
          { id: "ana-local", personId: "ana", name: "Ana" },
        ],
      },
    };
    rerender(view(updated, onAddGroup));
    expect(screen.getByText("2 of 4 added")).toBeTruthy();
    expect(
      within(screen.getByTestId("group-member-grid"))
        .getAllByRole("button")
        .map((button) => button.props.accessibilityLabel),
    ).toEqual([
      "Add Maya from Roomies",
      "Add Sarah from Roomies",
      "Ana already added from Roomies",
      "David already added from Roomies",
    ]);
    await act(async () => {
      fireEvent.press(
        screen.getByLabelText("Add 2 remaining members of Roomies"),
      );
    });
    expect(onAddGroup).toHaveBeenLastCalledWith("roomies", ["maya", "sarah"]);
    rerender(
      view(
        {
          ...record,
          values: {
            ...record.values,
            participants: people
              .filter((person) => person.id !== "lee")
              .map((person) => ({
                id: `${person.id}-local`,
                personId: person.id,
                name: person.name,
              })),
          },
        },
        onAddGroup,
      ),
    );
    expect(screen.getByText("All added")).toBeTruthy();
    expect(
      screen.getByLabelText("Add 0 remaining members of Roomies"),
    ).toBeDisabled();
  });

  it("remembers the selected group across mode switches and recognizes overlap", () => {
    render(view());
    fireEvent.press(screen.getByRole("tab", { name: "Groups" }));
    fireEvent.press(screen.getByLabelText("Select group Trip Crew"));
    expect(screen.getByLabelText("Add Lee from Trip Crew")).toBeTruthy();
    fireEvent.press(screen.getByRole("tab", { name: "Frequent" }));
    fireEvent.press(screen.getByRole("tab", { name: "Groups" }));
    expect(
      screen.getByLabelText("Select group Trip Crew").props.accessibilityState
        .selected,
    ).toBe(true);
    expect(screen.getByLabelText("Add Lee from Trip Crew")).toBeTruthy();
  });

  it("uses a full-width member row when its container is narrow", () => {
    render(view());
    fireEvent.press(screen.getByRole("tab", { name: "Groups" }));
    const grid = screen.getByTestId("group-member-grid");
    fireEvent(grid.parent!, "layout", {
      nativeEvent: { layout: { width: 280 } },
    });
    expect(
      StyleSheet.flatten(
        screen.getByLabelText("Add Ana from Roomies").props.style,
      ).width,
    ).toBe("100%");
  });

  it("guides users to People when there are no groups", () => {
    render(
      view(
        record,
        jest.fn(async () => undefined),
        { ...settings, participantGroups: [] },
        "pt",
      ),
    );
    fireEvent.press(screen.getByRole("tab", { name: "Grupos" }));
    expect(screen.getByText("Ainda não há grupos")).toBeTruthy();
    expect(
      screen.getByText(
        "Cria grupos em Pessoas para adicionares várias pessoas de uma vez.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("groups-empty-icon")).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId("groups-empty-card").props.style),
    ).toMatchObject({ paddingHorizontal: 16, paddingVertical: 12 });
  });
});
