import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Keyboard, Share, StyleSheet, TextInput } from "react-native";
import * as domain from "../../domain";

import {
  AssignItemScreen,
  HomeScreen,
  ItemsScreen,
  OverviewScreen,
  ParticipantsScreen,
  PasteImportScreen,
  PayerScreen,
  ReviewScreen,
  ResultsScreen,
  SetupScreen,
  SplitItemScreen,
} from "./screens";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockSetStringAsync = jest.fn(async (..._args: any[]) => undefined);
const mockShare = jest.fn(async (..._args: any[]) => undefined);
const mockAlert = jest.fn();
const mockRequestCameraPermissionsAsync = jest.fn(async () => ({ granted: true }));
const mockRequestMediaLibraryPermissionsAsync = jest.fn(async () => ({ granted: true }));
const mockLaunchCameraAsync = jest.fn(async () => ({ canceled: true, assets: [] }));
const mockLaunchImageLibraryAsync = jest.fn(async () => ({ canceled: true, assets: [] }));

let mockStoreState: any;

jest.mock("expo-router", () => ({
  router: {
    push: (value: any) => mockPush(value),
    back: () => mockBack(),
    replace: (value: any) => mockReplace(value),
  },
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: (value: string) => mockSetStringAsync(value),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: () => mockRequestCameraPermissionsAsync(),
  requestMediaLibraryPermissionsAsync: () => mockRequestMediaLibraryPermissionsAsync(),
  launchCameraAsync: () => mockLaunchCameraAsync(),
  launchImageLibraryAsync: () => mockLaunchImageLibraryAsync(),
}));

jest.mock("./store", () => ({
  STEP_ROUTE: {
    1: "setup",
    2: "participants",
    3: "payer",
    4: "items",
    5: "overview",
    6: "results",
  },
  useSplitStore: jest.fn((selector: any) => selector(mockStoreState)),
  getSettlementPreview: jest.fn((record: any) =>
    record
      ? {
          ok: true,
          data: {
            currency: "EUR",
            totalCents: 900,
            itemBreakdown: [
              {
                id: "item-1",
                name: "Groceries",
                splitMode: "even",
                amountCents: 900,
                shares: [
                  { participantId: "ana", amountCents: 300 },
                  { participantId: "bruno", amountCents: 300 },
                  { participantId: "zoe", amountCents: 300 },
                ],
              },
            ],
            people: [
              { participantId: "ana", name: "Ana", isPayer: true, paidCents: 900, consumedCents: 300, netCents: 600 },
              { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: 300, netCents: -300 },
              { participantId: "zoe", name: "Zoe", isPayer: false, paidCents: 0, consumedCents: 300, netCents: -300 },
            ],
            transfers: [],
          },
        }
      : null
  ),
  getClipboardSummaryPreview: jest.fn((record: any) =>
    record ? "Split Bill summary\nAna: paid EUR 9.00 and should get back EUR 6.00." : null
  ),
  getPdfExportPreview: jest.fn((record: any) => (record ? { fileName: "split-bill-2026-03-09.pdf" } : null)),
}));

function buildRecord(overrides: Partial<any> = {}) {
  return {
    id: "draft-1",
    status: "draft" as const,
    step: 1,
    createdAt: "2026-04-04T10:00:00.000Z",
    updatedAt: "2026-04-04T10:00:00.000Z",
    completedAt: null,
    settlementState: {
      settledParticipantIds: [],
    },
    values: {
      splitName: "",
      currency: "EUR",
      payerParticipantId: "ana",
      participants: [
        { id: "ana", name: "Ana" },
        { id: "bruno", name: "Bruno" },
        { id: "zoe", name: "Zoe" },
      ],
      items: [
        {
          id: "item-1",
          name: "Groceries",
          price: "9.00",
          splitMode: "even",
          allocations: [
            { participantId: "ana", evenIncluded: true, shares: "1", percent: "33.34", percentLocked: false },
            { participantId: "bruno", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
            { participantId: "zoe", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
          ],
        },
      ],
    },
    ...overrides,
  };
}

function buildStore(overrides: Partial<any> = {}) {
  return {
    ready: true,
    records: [buildRecord()],
    activeRecordId: "draft-1",
    settings: {
      ownerName: "Ana",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      trackPaymentsFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    },
    bootstrap: jest.fn(),
    createDraft: jest.fn(async () => buildRecord({ id: "draft-2" })),
    openRecord: jest.fn(async () => buildRecord()),
    removeRecord: jest.fn(async () => undefined),
    setStep: jest.fn(async () => undefined),
    updateParticipants: jest.fn(async () => undefined),
    setPayer: jest.fn(async () => undefined),
    addItem: jest.fn(async () => ({
      id: "item-new",
      name: "",
      price: "",
      category: "",
      splitMode: "even",
      allocations: [
        { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
        { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
      ],
    })),
    createItem: jest.fn(async () => undefined),
    saveItemSplit: jest.fn(async () => undefined),
    updateItemField: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
    setItemSplitMode: jest.fn(async () => undefined),
    toggleEvenIncluded: jest.fn(async () => undefined),
    setItemSharesValue: jest.fn(async () => undefined),
    setItemPercentValue: jest.fn(async () => true),
    resetItemAllocations: jest.fn(async () => undefined),
    focusOnlyParticipant: jest.fn(async () => undefined),
    importPastedList: jest.fn(async () => ({ warningMessages: [] })),
    updateSettings: jest.fn(async () => undefined),
    updateDraftMeta: jest.fn(async () => undefined),
    markBillPaid: jest.fn(async () => undefined),
    revertBillPaid: jest.fn(async () => undefined),
    toggleParticipantPaid: jest.fn(async () => undefined),
    markCompleted: jest.fn(async () => undefined),
    getActiveRecord: jest.fn(() => buildRecord()),
    ...overrides,
  };
}

describe("split screens", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockReplace.mockReset();
    mockSetStringAsync.mockReset();
    mockShare.mockReset();
    mockAlert.mockReset();
    mockRequestCameraPermissionsAsync.mockReset();
    mockRequestMediaLibraryPermissionsAsync.mockReset();
    mockLaunchCameraAsync.mockReset();
    mockLaunchImageLibraryAsync.mockReset();
    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mockLaunchCameraAsync.mockResolvedValue({ canceled: true, assets: [] });
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
    jest.spyOn(Alert, "alert").mockImplementation((title?: string, message?: string, buttons?: any) => {
      mockAlert(title, message, buttons);
    });
    jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
    jest.spyOn(Share, "share").mockImplementation(async (value: any) => {
      mockShare(value);
      return { action: "sharedAction" } as any;
    });
    mockStoreState = buildStore();
    const store = require("./store");
    store.getSettlementPreview.mockImplementation((record: any) =>
      record
        ? {
            ok: true,
            data: {
              currency: "EUR",
              totalCents: 900,
              itemBreakdown: [
                {
                  id: "item-1",
                  name: "Groceries",
                  splitMode: "even",
                  amountCents: 900,
                  shares: [
                    { participantId: "ana", amountCents: 300 },
                    { participantId: "bruno", amountCents: 300 },
                    { participantId: "zoe", amountCents: 300 },
                  ],
                },
              ],
              people: [
                { participantId: "ana", name: "Ana", isPayer: true, paidCents: 900, consumedCents: 300, netCents: 600 },
                { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: 300, netCents: -300 },
                { participantId: "zoe", name: "Zoe", isPayer: false, paidCents: 0, consumedCents: 300, netCents: -300 },
              ],
              transfers: [],
            },
          }
        : null
    );
    store.getClipboardSummaryPreview.mockImplementation((record: any) =>
      record ? "Split Bill summary\nAna: paid EUR 9.00 and should get back EUR 6.00." : null
    );
    store.getPdfExportPreview.mockImplementation((record: any) => (record ? { fileName: "split-bill-2026-03-09.pdf" } : null));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the setup step and saves split name and currency before continuing", async () => {
    render(<SetupScreen draftId="draft-1" />);
    expect(screen.getByText("New Split")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Weekend groceries"), "April groceries");
    fireEvent.press(screen.getByLabelText("Choose currency"));
    fireEvent.press(screen.getByLabelText("Choose currency USD"));
    await act(async () => {
      fireEvent.press(screen.getByText("Next: Add Participants"));
    });
    expect(mockStoreState.updateDraftMeta).toHaveBeenCalledWith("April groceries", "USD");
    expect(mockStoreState.setStep).toHaveBeenCalledWith(2);
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/participants");
  });

  it("limits split names to 20 characters before saving", async () => {
    render(<SetupScreen draftId="draft-1" />);
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Weekend groceries"), "1234567890123456789012345");
    await act(async () => {
      fireEvent.press(screen.getByText("Next: Add Participants"));
    });
    expect(mockStoreState.updateDraftMeta).toHaveBeenCalledWith("12345678901234567890", "EUR");
  });

  it("renders the setup loading state and opens the currency dropdown", async () => {
    mockStoreState.records = [];
    const { rerender } = render(<SetupScreen draftId="draft-1" />);
    expect(screen.getByText("Loading draft")).toBeTruthy();

    mockStoreState.records = [buildRecord()];
    rerender(<SetupScreen draftId="draft-1" />);
    fireEvent.press(screen.getByLabelText("Choose currency"));
    expect(screen.getAllByText("Euro (€)").length).toBeGreaterThan(0);
    expect(screen.getByText("US Dollar ($)")).toBeTruthy();
  });

  it("keeps the setup CTA disabled when no default or draft currency exists", async () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      balanceFeatureEnabled: true,
      defaultCurrency: "",
    };
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          currency: "",
        },
      }),
    ];

    render(<SetupScreen draftId="draft-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Next: Add Participants"));
    });
    expect(mockStoreState.updateDraftMeta).not.toHaveBeenCalled();
  });

  it("shows and clears the setup popup when the user tries to continue without a bill name", async () => {
    render(<SetupScreen draftId="draft-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Next: Add Participants"));
    });
    expect(screen.getByText("Please give this bill a short name first.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    expect(screen.queryByText("Please give this bill a short name first.")).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText("Next: Add Participants"));
    });
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Weekend groceries"), "Dinner");
    expect(screen.queryByText("Please give this bill a short name first.")).toBeNull();
  });

  it("falls back to defaults when setup metadata is missing on a loaded draft", () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      balanceFeatureEnabled: true,
      defaultCurrency: "GBP",
    };
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          splitName: undefined,
          currency: undefined,
        },
      }),
    ];

    render(<SetupScreen draftId="draft-1" />);
    expect(screen.getByText("British Pound (£)")).toBeTruthy();
  });

  it("routes the setup back and close actions to home and allows choosing a preset currency", () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      balanceFeatureEnabled: true,
      defaultCurrency: "GBP",
    };
    render(<SetupScreen draftId="draft-1" />);
    fireEvent.press(screen.getByLabelText("Choose currency"));
    fireEvent.press(screen.getByLabelText("Choose currency GBP"));
    expect(screen.getByText("British Pound (£)")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Back"));
    fireEvent.press(screen.getByLabelText("Close"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("renders participants loading state and participant management", async () => {
    mockStoreState.records = [];
    const { rerender } = render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.getByText("Loading draft")).toBeTruthy();

    mockStoreState.records = [
      buildRecord(),
      buildRecord({
        id: "draft-older",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "elena", name: "Elena" },
            { id: "marcus", name: "Marcus" },
          ],
        },
      }),
    ];
    rerender(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.getByText("Who's splitting?")).toBeTruthy();
    expect(screen.getByText("Frequent Participants")).toBeTruthy();
    expect(screen.queryByText("Organizer")).toBeNull();
    expect(screen.getByText("Next: Select Payer")).toBeTruthy();
    expect(screen.getByLabelText("Next: Select Payer")).toBeEnabled();
    fireEvent.changeText(screen.getByPlaceholderText("Enter name"), "Maya");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add person"));
    });
    expect(mockStoreState.updateParticipants).toHaveBeenCalled();
    fireEvent.changeText(screen.getByPlaceholderText("Enter name"), "Nora");
    await act(async () => {
      fireEvent(screen.getByPlaceholderText("Enter name"), "submitEditing");
    });
    expect(mockStoreState.updateParticipants).toHaveBeenCalledTimes(2);
  });

  it("submits from the add-person button with the keyboard still open", async () => {
    render(<ParticipantsScreen draftId="draft-1" />);
    fireEvent.changeText(screen.getByPlaceholderText("Enter name"), "Maya");

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add person"));
    });

    expect(mockStoreState.updateParticipants).toHaveBeenCalledTimes(1);
    expect(mockStoreState.updateParticipants).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "Maya" })])
    );
  });

  it("opens the requested draft when the active record differs", async () => {
    mockStoreState.records = [buildRecord()];
    mockStoreState.activeRecordId = "other-draft";
    let resolveOpenRecord: ((value: any) => void) | null = null;
    mockStoreState.openRecord = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveOpenRecord = resolve;
        })
    );

    const { rerender } = render(<ParticipantsScreen draftId="draft-1" />);
    expect(mockStoreState.openRecord).toHaveBeenCalledWith("draft-1");
    await act(async () => {
      resolveOpenRecord?.(buildRecord());
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    mockStoreState.records = [buildRecord()];
    rerender(<ParticipantsScreen draftId="draft-1" />);
  });

  it("cleans up pending draft-open requests after a missing draft finishes opening", async () => {
    mockStoreState.records = [];
    mockStoreState.activeRecordId = "other-draft";
    let resolveOpenRecord: ((value: any) => void) | null = null;
    mockStoreState.openRecord = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveOpenRecord = resolve;
        })
    );

    render(<ParticipantsScreen draftId="draft-1" />);
    expect(mockStoreState.openRecord).toHaveBeenCalledWith("draft-1");

    await act(async () => {
      resolveOpenRecord?.(buildRecord());
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it("saves a new item into the requested draft even when another draft was active", async () => {
    mockStoreState.records = [buildRecord()];
    mockStoreState.activeRecordId = "other-draft";

    render(<AssignItemScreen draftId="draft-1" itemId="new" />);
    expect(mockStoreState.openRecord).toHaveBeenCalledWith("draft-1");

    fireEvent.changeText(screen.getByPlaceholderText("e.g. Truffle Pasta"), "Milk");
    fireEvent.changeText(screen.getByPlaceholderText(/0,00/), "2.50");

    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });

    expect(mockStoreState.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Milk",
        price: "2.50",
        category: "General",
      })
    );
  });

  it("handles participants validation and suggestion actions", async () => {
    mockStoreState.records = [
      buildRecord({ values: { ...buildRecord().values, participants: [], payerParticipantId: "" } }),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [{ id: "elena", name: "Elena" }],
        },
      }),
    ];
    render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.queryByText("Almost there")).toBeNull();
    expect(screen.getByLabelText("Next: Select Payer")).toBeDisabled();
    fireEvent.press(screen.getByText("Next: Select Payer"));
    expect(screen.getByText("Almost there")).toBeTruthy();
    expect(screen.getByText("Add at least two participants, including the payer.")).toBeTruthy();
    expect(mockStoreState.setStep).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    expect(screen.queryByText("Almost there")).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add frequent friend Elena"));
    });
    expect(mockStoreState.updateParticipants).toHaveBeenCalled();
  });

  it("renders fallback initials and empty participant guidance", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [{ id: "blank", name: "   " }],
        },
      }),
    ];

    render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("covers valid continue, duplicate suggestions, blank adds, and participant removal", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          payerParticipantId: "",
          participants: [
            { id: "ana", name: "Ana" },
            { id: "elena", name: "Elena" },
          ],
        },
      }),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "elena-2", name: "Elena" },
            { id: "maya", name: "Maya" },
          ],
        },
      }),
    ];

    render(<ParticipantsScreen draftId="draft-1" />);
    const priorCalls = mockStoreState.updateParticipants.mock.calls.length;
    expect(screen.queryByLabelText("Add frequent friend Elena")).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add frequent friend Maya"));
    });
    expect(mockStoreState.updateParticipants).toHaveBeenCalledTimes(priorCalls + 1);

    fireEvent.changeText(screen.getByPlaceholderText("Enter name"), "Ana");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add person"));
    });
    expect(mockStoreState.updateParticipants).toHaveBeenCalledTimes(priorCalls + 1);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add person"));
    });
    expect(mockStoreState.updateParticipants).toHaveBeenCalledTimes(priorCalls + 1);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Remove participant Ana"));
    });
    expect(mockStoreState.updateParticipants).toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByText("Next: Select Payer"));
    });
    await waitFor(() => {
      expect(mockStoreState.setStep).toHaveBeenCalledWith(3);
      expect(mockPush).toHaveBeenCalledWith("/split/draft-1/payer");
    });
  });

  it("shows the participants popup hint after an attempted advance", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [{ id: "ana", name: "Ana" }],
          payerParticipantId: "",
        },
      }),
    ];

    render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.queryByText("Almost there")).toBeNull();
    expect(screen.getByLabelText("Next: Select Payer")).toBeDisabled();
    fireEvent.press(screen.getByText("Next: Select Payer"));
    expect(screen.getByText("Almost there")).toBeTruthy();
    expect(screen.getByText("Add at least two participants, including the payer.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    expect(screen.queryByText("Almost there")).toBeNull();
  });

  it("supports the custom participants back header action", () => {
    mockStoreState.records = [
      buildRecord(),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [{ id: "elena", name: "Elena" }],
        },
      }),
    ];
    render(<ParticipantsScreen draftId="draft-1" />);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockReplace).toHaveBeenCalledWith("/split/draft-1/setup");
  });

  it("routes the participants close header action to home", () => {
    render(<ParticipantsScreen draftId="draft-1" />);
    fireEvent.press(screen.getByLabelText("Close"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("always shows the phone owner in frequent friends when not already added and dedupes/caps history suggestions", () => {
    mockStoreState.settings = {
      ownerName: "Tiago",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
    };
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [],
          payerParticipantId: "",
        },
      }),
    ];
    const view = render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.getByText("Frequent Participants")).toBeTruthy();
    expect(screen.getByLabelText("Add frequent friend Tiago")).toBeTruthy();

    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [],
          payerParticipantId: "",
        },
      }),
      buildRecord({
        id: "draft-newer",
        updatedAt: "2026-04-04T09:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "sarah", name: "Sarah" },
            { id: "david", name: "David" },
            { id: "maya", name: "Maya" },
          ],
        },
      }),
      buildRecord({
        id: "draft-older",
        updatedAt: "2026-04-03T09:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "elena", name: "Elena" },
            { id: "marcus", name: "Marcus" },
            { id: "sarah-duplicate", name: "Sarah" },
            { id: "blank", name: "   " },
            { id: "zoe", name: "Zoe" },
            { id: "nora", name: "Nora" },
          ],
        },
      }),
    ];

    view.rerender(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.getByText("Frequent Participants")).toBeTruthy();
    const labels = Array.from(new Set(
      view.UNSAFE_root
        .findAll((node: any) => typeof node.props.accessibilityLabel === "string" && node.props.accessibilityLabel.startsWith("Add frequent friend "))
        .map((node: any) => node.props.accessibilityLabel)
    ));
    expect(labels[0]).toBe("Add frequent friend Tiago");
    expect(screen.getByText("Tiago")).toBeTruthy();
    expect(screen.getByText("Sarah")).toBeTruthy();
    expect(screen.getByText("David")).toBeTruthy();
    expect(screen.getByText("Maya")).toBeTruthy();
    expect(screen.getByText("Elena")).toBeTruthy();
    expect(screen.queryByText("Marcus")).toBeNull();
    expect(screen.queryByLabelText("Add frequent friend Zoe")).toBeNull();
    expect(screen.queryByLabelText("Add frequent friend Nora")).toBeNull();
  });

  it("injects the phone owner into frequent friends when missing from history", () => {
    mockStoreState.settings = {
      ownerName: "Tiago",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
    };
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [{ id: "ana", name: "Ana" }],
          payerParticipantId: "",
        },
      }),
    ];

    render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.getByLabelText("Add frequent friend Tiago")).toBeTruthy();
  });

  it("skips blank and duplicate names when building frequent friends from history", () => {
    mockStoreState.records = [
      buildRecord(),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "blank", name: "   " },
            { id: "elena", name: "Elena" },
            { id: "elena-duplicate", name: "Elena" },
            { id: "marcus", name: "Marcus" },
          ],
        },
      }),
    ];

    render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.getByLabelText("Add frequent friend Elena")).toBeTruthy();
    expect(screen.getByLabelText("Add frequent friend Marcus")).toBeTruthy();
    expect(screen.queryByLabelText("Add frequent friend ")).toBeNull();
  });

  it("orders frequent friends by most recent appearance, then appearance count, then alphabetical", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [{ id: "ana", name: "Ana" }],
          payerParticipantId: "",
        },
      }),
      buildRecord({
        id: "draft-count-tie-break-a",
        updatedAt: "2026-04-03T09:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "bruno-a", name: "Bruno" },
            { id: "clara-a", name: "Clara" },
          ],
        },
      }),
      buildRecord({
        id: "draft-older-alex",
        updatedAt: "2026-04-02T09:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [{ id: "alex-older", name: "Alex" }],
        },
      }),
      buildRecord({
        id: "draft-count-tie-break-b",
        updatedAt: "2026-04-03T09:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "clara-b", name: "Clara" },
            { id: "bruno-b", name: "Bruno" },
          ],
        },
      }),
      buildRecord({
        id: "draft-most-recent",
        updatedAt: "2026-04-04T09:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "zoe", name: "Zoe" },
            { id: "alex", name: "Alex" },
          ],
        },
      }),
    ];

    const view = render(<ParticipantsScreen draftId="draft-1" />);
    const labels = Array.from(new Set(
      view.UNSAFE_root
        .findAll((node: any) => typeof node.props.accessibilityLabel === "string" && node.props.accessibilityLabel.startsWith("Add frequent friend "))
        .map((node: any) => node.props.accessibilityLabel)
    ));

    expect(labels).toEqual([
      "Add frequent friend Alex",
      "Add frequent friend Zoe",
      "Add frequent friend Bruno",
      "Add frequent friend Clara",
    ]);
  });

  it("returns mapped frequent friends without injecting the owner when they already exist in history", () => {
    mockStoreState.settings = {
      ownerName: "Sarah",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
    };
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [{ id: "ana", name: "Ana" }],
          payerParticipantId: "",
        },
      }),
      buildRecord({
        id: "draft-history-owner",
        updatedAt: "2026-04-04T09:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "sarah", name: "Sarah" },
            { id: "maria", name: "Maria" },
          ],
        },
      }),
    ];

    render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.getByLabelText("Add frequent friend Sarah")).toBeTruthy();
    expect(screen.getByLabelText("Add frequent friend Maria")).toBeTruthy();
  });

  it("keeps avatar colors deterministic for the same non-organizer participant across sections", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [{ id: "adriano", name: "Adriano" }],
          payerParticipantId: "",
        },
      }),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "tiago-history", name: "Tiago" },
            { id: "rodrigo", name: "Rodrigo" },
          ],
        },
      }),
    ];

    const { rerender } = render(<ParticipantsScreen draftId="draft-1" />);
    const frequentAvatar = screen.getByLabelText("Frequent friend avatar Tiago");
    const frequentColor = StyleSheet.flatten(frequentAvatar.props.style).backgroundColor;

    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [
            { id: "adriano", name: "Adriano" },
            { id: "tiago", name: "Tiago" },
          ],
          payerParticipantId: "",
        },
      }),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "tiago-history", name: "Tiago" },
            { id: "rodrigo", name: "Rodrigo" },
          ],
        },
      }),
    ];

    rerender(<ParticipantsScreen draftId="draft-1" />);
    const participantAvatar = screen.getByLabelText("Participant avatar Tiago");

    expect(frequentColor).toBe(StyleSheet.flatten(participantAvatar.props.style).backgroundColor);
  });

  it("removes already-selected frequent friends from the suggestion strip", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [{ id: "tiago", name: "Tiago" }],
          payerParticipantId: "",
        },
      }),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [
            { id: "tiago-history", name: "Tiago" },
            { id: "rodrigo", name: "Rodrigo" },
          ],
        },
      }),
    ];

    render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.queryByLabelText("Add frequent friend Tiago")).toBeNull();
    expect(screen.getByLabelText("Add frequent friend Rodrigo")).toBeTruthy();
  });

  it("returns only history-based frequent friends when the owner name is blank", () => {
    mockStoreState.settings = {
      ownerName: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
    };
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [],
          payerParticipantId: "",
        },
      }),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [{ id: "maya", name: "Maya" }],
        },
      }),
    ];

    render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.getByLabelText("Add frequent friend Maya")).toBeTruthy();
    expect(screen.queryByLabelText("Add frequent friend ")).toBeNull();
  });

  it("does not keep the keyboard open after adding a frequent friend", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [{ id: "ana", name: "Ana" }],
          payerParticipantId: "",
        },
      }),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [{ id: "maya", name: "Maya" }],
        },
      }),
    ];

    render(<ParticipantsScreen draftId="draft-1" />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add frequent friend Maya"));
    });
    expect(Keyboard.dismiss).toHaveBeenCalled();
  });

  it("uses the current owner profile name for frequent participants and owner labels", () => {
    mockStoreState.settings = {
      ownerName: "Tiago Luiz",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };
    mockStoreState.records = [
      buildRecord({
        id: "draft-current",
        values: {
          ...buildRecord().values,
          participants: [{ id: "owner", name: "You" }, { id: "bruno", name: "Bruno" }],
          payerParticipantId: "owner",
          items: [],
        },
      }),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [{ id: "owner", name: "You" }, { id: "maria", name: "Maria" }],
        },
      }),
    ];

    const { unmount } = render(<ParticipantsScreen draftId="draft-current" />);
    expect(screen.getByText("Tiago Luiz")).toBeTruthy();
    expect(screen.queryByText(/^You$/)).toBeNull();

    unmount();

    render(<PayerScreen draftId="draft-current" />);
    expect(screen.getByText("Tiago Luiz (You)")).toBeTruthy();
  });

  it("does not treat blank participant names as the owner", () => {
    mockStoreState.settings = {
      ownerName: "Tiago Luiz",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };
    mockStoreState.records = [
      buildRecord({
        id: "draft-current",
        values: {
          ...buildRecord().values,
          participants: [{ id: "owner", name: "" }, { id: "bruno", name: "Bruno" }],
          payerParticipantId: "bruno",
          items: [],
        },
      }),
    ];

    render(<PayerScreen draftId="draft-current" />);
    expect(screen.queryByText("Tiago Luiz (You)")).toBeNull();
  });

  it("ignores blank settlement names when resolving the current owner", () => {
    const store = require("./store");
    store.getSettlementPreview.mockImplementation(() => ({
      ok: true,
      data: {
        currency: "EUR",
        totalCents: 900,
        itemBreakdown: [],
        people: [
          { participantId: "blank", name: "", isPayer: false, paidCents: 0, consumedCents: 300, netCents: -300 },
          { participantId: "payer", name: "Bruno", isPayer: true, paidCents: 900, consumedCents: 600, netCents: 300 },
        ],
        transfers: [],
      },
    }));

    mockStoreState.settings = {
      ownerName: "Tiago Luiz",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };

    render(<HomeScreen />);
    expect(screen.getByText("You are owed")).toBeTruthy();
  });

  it("falls back to the participant name when the owner setting is blank", () => {
    mockStoreState.settings = {
      ownerName: "",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };
    mockStoreState.records = [
      buildRecord({
        id: "draft-current",
        values: {
          ...buildRecord().values,
          participants: [{ id: "owner", name: "You" }, { id: "bruno", name: "Bruno" }],
          payerParticipantId: "owner",
          items: [],
        },
      }),
    ];

    render(<PayerScreen draftId="draft-current" />);
    expect(screen.getByText("You (You)")).toBeTruthy();
  });

  it("renders payer selection and continues when valid", async () => {
    render(<PayerScreen draftId="draft-1" />);
    expect(screen.getByText("Next: Add Items")).toBeTruthy();
    expect(screen.queryByText("One payer only")).toBeNull();
    expect(screen.getByLabelText("Next: Add Items")).toBeEnabled();
    fireEvent.press(screen.getByLabelText("Choose payer Bruno"));
    expect(mockStoreState.setPayer).toHaveBeenCalledWith("bruno");
    await act(async () => {
      fireEvent.press(screen.getByText("Next: Add Items"));
    });
    await waitFor(() => {
      expect(mockStoreState.setStep).toHaveBeenCalledWith(4);
      expect(mockPush).toHaveBeenCalledWith("/split/draft-1/items");
    });
  });

  it("uses the saved owner photo inside split flows", () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      ownerProfileImageUri: "file:///owner-photo.png",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };

    const { unmount } = render(<PayerScreen draftId="draft-1" />);
    expect(screen.getByLabelText("Payer avatar Ana").props.source).toEqual({ uri: "file:///owner-photo.png" });

    unmount();

    render(<ResultsScreen draftId="draft-1" />);
    expect(screen.getByLabelText("Results avatar Ana").props.source).toEqual({ uri: "file:///owner-photo.png" });
  });

  it("uses the saved owner photo in the frequent participants strip", () => {
    mockStoreState.settings = {
      ownerName: "Tiago",
      ownerProfileImageUri: "file:///owner-photo.png",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [{ id: "bruno", name: "Bruno" }],
          payerParticipantId: "",
        },
      }),
      buildRecord({
        id: "draft-history",
        updatedAt: "2026-04-03T10:00:00.000Z",
        values: {
          ...buildRecord().values,
          participants: [{ id: "owner", name: "Tiago" }, { id: "maya", name: "Maya" }],
        },
      }),
    ];

    render(<ParticipantsScreen draftId="draft-1" />);
    expect(screen.getByLabelText("Frequent friend avatar Tiago").props.source).toEqual({ uri: "file:///owner-photo.png" });
  });

  it("alerts when payer is missing", () => {
    mockStoreState.records = [buildRecord({ values: { ...buildRecord().values, payerParticipantId: "" } })];
    render(<PayerScreen draftId="draft-1" />);
    expect(screen.queryByText("Almost there")).toBeNull();
    expect(screen.queryByText("Choose who paid the bill.")).toBeNull();
    expect(screen.getByLabelText("Next: Add Items")).toBeDisabled();
    fireEvent.press(screen.getByText("Next: Add Items"));
    expect(screen.getByText("Almost there")).toBeTruthy();
    expect(screen.getByText("Choose who paid the bill.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    expect(screen.queryByText("Choose who paid the bill.")).toBeNull();
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockStoreState.setStep).not.toHaveBeenCalled();
  });

  it("renders the payer loading state", () => {
    mockStoreState.records = [];
    render(<PayerScreen draftId="draft-1" />);
    expect(screen.getByText("Loading draft")).toBeTruthy();
  });

  it("routes the payer back header action to participants explicitly", () => {
    render(<PayerScreen draftId="draft-1" />);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockReplace).toHaveBeenCalledWith("/split/draft-1/participants");
  });

  it("routes the payer close header action to home", () => {
    render(<PayerScreen draftId="draft-1" />);
    fireEvent.press(screen.getByLabelText("Close"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("renders items flow and paste navigation", async () => {
    render(<ItemsScreen draftId="draft-1" />);
    expect(screen.getByText("Add Items")).toBeTruthy();
    expect(screen.getByText("Import Receipt")).toBeTruthy();
    expect(screen.queryByText("Fast & accurate")).toBeNull();
    expect(screen.queryByText("Items Added")).toBeNull();
    expect(screen.getByText("Running total")).toBeTruthy();
    expect(screen.getAllByText("Soon")).toHaveLength(1);
    expect(screen.getByLabelText("Scan Photo coming soon")).toBeTruthy();
    expect(screen.getByLabelText("AI Paste coming soon")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockReplace).toHaveBeenCalledWith("/split/draft-1/payer");
    fireEvent.press(screen.getByText("Groceries"));
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/assign/item-1");
    await act(async () => {
      fireEvent.press(screen.getByText("Add Item Manually"));
    });
    expect(mockStoreState.addItem).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/assign/new");
    fireEvent.press(screen.getByLabelText("Close"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("renders items loading, invalid review, valid review, and swipe-delete actions", async () => {
    mockStoreState.records = [];
    const { rerender } = render(<ItemsScreen draftId="draft-1" />);
    expect(screen.getByText("Loading draft")).toBeTruthy();

    mockStoreState.records = [buildRecord({ values: { ...buildRecord().values, items: [{ ...buildRecord().values.items[0], name: "", price: "" }] } })];
    rerender(<ItemsScreen draftId="draft-1" />);
    expect(screen.queryByText("Not there yet...")).toBeNull();
    expect(screen.getByLabelText("Next: Split Bill")).toBeDisabled();
    expect(screen.getByText("0 items")).toBeTruthy();
    expect(screen.queryByText("Item 1")).toBeNull();
    fireEvent.press(screen.getByText("Next: Split Bill"));
    expect(screen.getByText("Almost there")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    expect(screen.queryByText("Almost there")).toBeNull();
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockStoreState.setStep).not.toHaveBeenCalled();

    mockStoreState.records = [buildRecord()];
    rerender(<ItemsScreen draftId="draft-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Next: Split Bill"));
    });
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/overview");

    jest.useFakeTimers();
    fireEvent.press(screen.getByLabelText("Delete item Groceries"));
    expect(screen.getByText("Item deleted")).toBeTruthy();
    expect(screen.queryByLabelText("Delete item Groceries")).toBeNull();
    expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    expect(mockStoreState.removeItem).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText("Undo item delete"));
    expect(screen.queryByText("Item deleted")).toBeNull();
    expect(screen.getByLabelText("Delete item Groceries")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Delete item Groceries"));
    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(mockStoreState.removeItem).toHaveBeenCalledWith("item-1");
    expect(screen.queryByText("Item deleted")).toBeNull();
    jest.useRealTimers();
  });

  it("keeps the items overview empty until the user adds an item manually", () => {
    mockStoreState.records = [buildRecord({ values: { ...buildRecord().values, items: [] } })];
    render(<ItemsScreen draftId="draft-1" />);
    expect(mockStoreState.addItem).not.toHaveBeenCalled();
    expect(screen.getByText("0 items")).toBeTruthy();
  });

  it("routes from items straight to review when all visible items are already assigned", async () => {
    render(<ItemsScreen draftId="draft-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Next: Split Bill"));
    });
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/overview");
  });

  it("routes from items into the latest pending split when an item is still unassigned", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              id: "item-1",
              allocations: buildRecord().values.items[0].allocations.map((allocation) => ({
                ...allocation,
                evenIncluded: false,
              })),
            },
            {
              ...buildRecord().values.items[0],
              id: "item-2",
              name: "Bread",
              allocations: buildRecord().values.items[0].allocations.map((allocation) => ({
                ...allocation,
                evenIncluded: false,
              })),
            },
          ],
        },
      }),
    ];

    render(<ItemsScreen draftId="draft-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Next: Split Bill"));
    });
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/split/item-2");
  });

  it("ignores queued item deletions when advancing from items into split", async () => {
    jest.useFakeTimers();
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              id: "item-1",
              allocations: buildRecord().values.items[0].allocations.map((allocation) => ({
                ...allocation,
                evenIncluded: false,
              })),
            },
            {
              ...buildRecord().values.items[0],
              id: "item-2",
              name: "Bread",
              allocations: buildRecord().values.items[0].allocations.map((allocation) => ({
                ...allocation,
                evenIncluded: false,
              })),
            },
          ],
        },
      }),
    ];

    render(<ItemsScreen draftId="draft-1" />);
    fireEvent.press(screen.getByLabelText("Delete item Bread"));
    expect(screen.queryByLabelText("Delete item Bread")).toBeNull();
    expect(screen.getByText("1 item")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText("Next: Split Bill"));
    });
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/split/item-1");
    jest.useRealTimers();
  });

  it("commits a queued item deletion after the undo window expires and clears timers on unmount", async () => {
    jest.useFakeTimers();
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            { ...buildRecord().values.items[0], id: "item-1", name: "Groceries" },
            { ...buildRecord().values.items[0], id: "item-2", name: "Bread" },
          ],
        },
      }),
    ];

    const view = render(<ItemsScreen draftId="draft-1" />);

    fireEvent.press(screen.getByLabelText("Delete item Groceries"));
    expect(screen.getByText("Item deleted")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Delete item Bread"));
    expect(mockStoreState.removeItem).toHaveBeenCalledWith("item-1");
    expect(screen.queryByLabelText("Delete item Bread")).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    expect(mockStoreState.removeItem).toHaveBeenCalledWith("item-2");
    expect(screen.queryByText("Item deleted")).toBeNull();

    mockStoreState.removeItem.mockClear();
    fireEvent.press(screen.getByLabelText("Delete item Groceries"));
    view.unmount();
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(mockStoreState.removeItem).toHaveBeenCalledWith("item-1");
    jest.useRealTimers();
  });

  it("lets the user undo an item deletion directly from the items footer", () => {
    jest.useFakeTimers();
    render(<ItemsScreen draftId="draft-1" />);
    fireEvent.press(screen.getByLabelText("Delete item Groceries"));
    fireEvent.press(screen.getByLabelText("Undo item delete"));
    expect(screen.queryByText("Item deleted")).toBeNull();
    expect(mockStoreState.removeItem).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("renders fallback item copy for visible rows with no name and an invalid amount", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              name: "",
              price: "oops",
              category: "Service",
            },
          ],
        },
      }),
    ];

    render(<ItemsScreen draftId="draft-1" />);
    expect(screen.getByText("Item 1")).toBeTruthy();
    expect(screen.getByText("SERVICE")).toBeTruthy();
    expect(screen.getAllByText(/0,00|€0.00|\$0.00|EUR 0.00/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Delete item Item 1")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Delete item Item 1"));
    expect(screen.getByText("Item deleted")).toBeTruthy();
  });

  it("creates a new item from inside the editor route instead of pre-creating it on the items screen", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="new" />);
    expect(screen.getByText("Add Item")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Truffle Pasta"), "Soup");
    expect(screen.getByText("Add Item")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText(/0,00/), "12.50");
    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });
    expect(mockStoreState.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Soup",
        price: "12.50",
        category: "General",
      })
    );
  });

  it("normalizes a new integer item price before saving", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="new" />);
    fireEvent.changeText(screen.getByLabelText("Item name"), "Water");
    fireEvent.changeText(screen.getByLabelText("Item price"), "1");
    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });

    expect(mockStoreState.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Water",
        price: "1.00",
      })
    );
  });

  it("normalizes an existing integer item price before updating", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Item price"), "1");
    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });

    expect(mockStoreState.updateItemField).toHaveBeenCalledWith("item-1", "price", "1.00");
  });

  it("limits item names to 25 characters before saving", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="new" />);
    fireEvent.changeText(screen.getByLabelText("Item name"), "123456789012345678901234567890");
    fireEvent.changeText(screen.getByPlaceholderText(/0,00/), "4.50");

    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });

    expect(mockStoreState.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "1234567890123456789012345",
      })
    );
  });

  it("shows General as the default category and lets existing items be deleted from the editor", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("General").props.color).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Delete Item"));
    });
    expect(screen.getByText("Delete item?")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Delete item"));
    });

    expect(mockStoreState.removeItem).toHaveBeenCalledWith("item-1");
    expect(mockBack).toHaveBeenCalled();
  });

  it("writes the default General category back when saving an older blank-category item", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], category: "" }],
        },
      }),
    ];

    render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });
    expect(mockStoreState.updateItemField).toHaveBeenCalledWith("item-1", "category", "General");
  });

  it("does not overwrite a chosen category when saving an existing categorized item", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], category: "Produce" }],
        },
      }),
    ];

    render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });
    expect(mockStoreState.updateItemField).not.toHaveBeenCalledWith("item-1", "category", "General");
  });

  it("does not persist a blank new item when leaving the new-item editor", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="new" />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Back"));
    });
    expect(mockStoreState.createItem).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  it("does not persist a blank new item when saving it", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="new" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });
    expect(mockStoreState.createItem).not.toHaveBeenCalled();
    expect(screen.getByText("Add a valid price before saving this item.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    expect(screen.queryByText("Add a valid price before saving this item.")).toBeNull();
  });

  it("does not allow saving a new zero-price item and keeps the editor open", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="new" />);
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Item price"), "0");
    });

    expect(screen.getByLabelText("Save Item").props.style).toEqual(
      expect.arrayContaining([expect.any(Object), expect.any(Object)])
    );

    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });

    expect(mockStoreState.createItem).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText("Add a valid price before saving this item.")).toBeTruthy();
  });

  it("does not allow saving a duplicate item with the same name, price, and category", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="new" />);

    fireEvent.changeText(screen.getByLabelText("Item name"), "Groceries");
    fireEvent.changeText(screen.getByLabelText("Item price"), "9.00");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Groceries")).toBeTruthy();
      expect(screen.getByDisplayValue("9.00")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });

    expect(mockStoreState.createItem).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText("This item already exists. Change the name, price, or category.")).toBeTruthy();
  });

  it("prompts before discarding a dirty new item from the back button", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="new" />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Item name"), "Bread");
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Back"));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Discard changes"));
    });

    expect(mockStoreState.removeItem).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  it("keeps the dirty new item editor open when discard is canceled", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="new" />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Item name"), "Bread");
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Back"));
    });

    expect(screen.getByText("Discard changes?")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Keep editing"));
    });

    expect(screen.queryByLabelText("Delete Item")).toBeNull();
    expect(mockStoreState.removeItem).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("keeps the discard-changes modal open flow reversible without leaving", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="new" />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Item name"), "Bread");
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Back"));
    });

    expect(screen.getByText("Discard changes?")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Keep editing"));
    });

    expect(screen.queryByText("Discard changes?")).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("does nothing when item deletion is canceled", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Delete Item"));
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Keep item"));
    });

    expect(mockStoreState.removeItem).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("moves from item name to price on submit and dismisses the keyboard from the price submit", () => {
    const focusSpy = jest.spyOn(TextInput.prototype, "focus").mockImplementation(() => undefined);
    const dismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);

    render(<AssignItemScreen draftId="draft-1" itemId="new" />);

    fireEvent(screen.getByLabelText("Item name"), "submitEditing");
    expect(focusSpy).toHaveBeenCalled();

    fireEvent(screen.getByLabelText("Item price"), "submitEditing");
    expect(dismissSpy).toHaveBeenCalled();
  });

  it("lets a new item be edited locally without mutating the stored draft until save", () => {
    const view = render(<AssignItemScreen draftId="draft-1" itemId="new" />);
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Truffle Pasta"), "Draftless");
    view.unmount();
    expect(mockStoreState.addItem).not.toHaveBeenCalled();
    expect(mockStoreState.createItem).not.toHaveBeenCalled();
  });

  it("applies pasted import and shows warnings", () => {
    mockStoreState.importPastedList = jest.fn(async () => ({ warningMessages: ["Ignored 1 pasted line."] }));
    render(<PasteImportScreen draftId="draft-1" />);
    fireEvent.changeText(screen.getByPlaceholderText("Bananas - 2.49\nTomatoes: 1.80\nMilk 3.40"), "Milk - 3.40");
    fireEvent.press(screen.getByText("Replace"));
    fireEvent.press(screen.getByText("Apply import"));
    expect(mockStoreState.importPastedList).toHaveBeenCalledWith("Milk - 3.40", "replace");
  });

  it("covers paste loading and warning-free import flows", async () => {
    mockStoreState.records = [];
    const { rerender } = render(<PasteImportScreen draftId="draft-1" />);
    expect(screen.getByText("Loading draft")).toBeTruthy();

    mockStoreState.importPastedList = jest.fn(async () => ({ warningMessages: [] }));
    mockStoreState.records = [buildRecord()];
    rerender(<PasteImportScreen draftId="draft-1" />);
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText("Bananas - 2.49\nTomatoes: 1.80\nMilk 3.40"), "Tea - 1.25");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Apply import"));
    });
    expect(mockBack).toHaveBeenCalled();
  });

  it("blocks empty pasted imports with a warning", async () => {
    render(<PasteImportScreen draftId="draft-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Apply import"));
    });
    expect(mockAlert).toHaveBeenCalledWith("Nothing to import", "Paste at least one line before applying import.", undefined);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("keeps the user on paste import when no valid items are detected", async () => {
    mockStoreState.importPastedList = jest.fn(async () => ({
      warningMessages: [
        "No valid items were detected. Use lines like `Bananas - 2.49`, `Bananas 2.49`, or `item,price`.",
      ],
    }));
    render(<PasteImportScreen draftId="draft-1" />);
    fireEvent.changeText(screen.getByPlaceholderText("Bananas - 2.49\nTomatoes: 1.80\nMilk 3.40"), "not a valid line");
    await act(async () => {
      fireEvent.press(screen.getByText("Apply import"));
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith(
      "Import failed",
      "No valid items were detected. Use lines like `Bananas - 2.49`, `Bananas 2.49`, or `item,price`.",
      undefined
    );
  });

  it("routes the paste close header action to home", () => {
    render(<PasteImportScreen draftId="draft-1" />);
    fireEvent.press(screen.getByLabelText("Close"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("renders assign-item variants and triggers metadata actions", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("Edit Item")).toBeTruthy();
    expect(screen.getByText("Category")).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue("Groceries"), "Bread");
    fireEvent.changeText(screen.getByDisplayValue("9.00"), "12.00");
    fireEvent.press(screen.getByLabelText("Choose category Produce"));
    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });
    expect(mockStoreState.updateItemField).toHaveBeenCalledWith("item-1", "name", "Bread");
    expect(mockStoreState.updateItemField).toHaveBeenCalledWith("item-1", "price", "12.00");
    expect(mockStoreState.updateItemField).toHaveBeenCalledWith("item-1", "category", "Produce");
    expect(mockBack).toHaveBeenCalled();
  });

  it("renders selected and unselected category chips distinctly and surfaces saved item categories in the list", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], category: "Produce" }],
        },
      }),
    ];

    const itemsView = render(<ItemsScreen draftId="draft-1" />);
    expect(screen.getByText("PRODUCE")).toBeTruthy();

    itemsView.unmount();

    render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    const selectedChip = screen.getByLabelText("Choose category Produce");
    const unselectedChip = screen.getByLabelText("Choose category Bakery");
    const selectedText = screen.getByText("Produce");
    const unselectedText = screen.getByText("Bakery");

    expect(StyleSheet.flatten(selectedChip.props.style).backgroundColor).not.toBe(
      StyleSheet.flatten(unselectedChip.props.style).backgroundColor
    );
    expect(selectedText.props.color).not.toBe(unselectedText.props.color);
  });

  it("covers assign-item controls for back, close, save, loading, and missing-item branches", async () => {
    const { rerender } = render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockBack).toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Close"));
    expect(mockReplace).toHaveBeenCalledWith("/");
    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });
    expect(mockBack).toHaveBeenCalled();

    mockStoreState.records = [];
    rerender(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("Loading draft")).toBeTruthy();

    mockStoreState.records = [buildRecord({ values: { ...buildRecord().values, items: [] } })];
    rerender(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("Item missing")).toBeTruthy();
  });

  it("does not auto-save existing item edits when backing out and can discard them", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], name: "", price: "", category: "" }],
        },
      }),
    ];

    const { rerender } = render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Item name"), "Bread");
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Back"));
    });
    expect(screen.getByText("Discard changes?")).toBeTruthy();
    expect(mockStoreState.updateItemField).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Discard changes"));
    });
    expect(mockStoreState.removeItem).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();

    mockStoreState.removeItem.mockClear();
    mockStoreState.updateItemField.mockClear();
    mockBack.mockClear();

    rerender(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });
    expect(mockStoreState.removeItem).not.toHaveBeenCalled();
    expect(screen.getByText("Add a valid price before saving this item.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    expect(screen.queryByText("Add a valid price before saving this item.")).toBeNull();
  });

  it("does not allow saving an existing zero-price item and keeps the editor open", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], price: "0" }],
        },
      }),
    ];

    render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);

    await act(async () => {
      fireEvent.press(screen.getByText("Save Item"));
    });

    expect(mockStoreState.removeItem).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText("Add a valid price before saving this item.")).toBeTruthy();
  });

  it("keeps existing item edits local until save and allows discarding them from back", async () => {
    render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Item name"), "Edited");
    });

    expect(mockStoreState.updateItemField).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Back"));
    });

    expect(screen.getByText("Discard changes?")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Keep editing"));
    });

    expect(screen.queryByText("Discard changes?")).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockStoreState.updateItemField).not.toHaveBeenCalled();
  });

  it("keeps local existing-item edits when the same item record rerenders", async () => {
    const { rerender } = render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Item name"), "Local edit");
    });

    mockStoreState.records = [buildRecord()];
    rerender(<AssignItemScreen draftId="draft-1" itemId="item-1" />);

    expect(screen.getByDisplayValue("Local edit")).toBeTruthy();
    expect(mockStoreState.updateItemField).not.toHaveBeenCalled();
  });

  it("renders assign-item fallback copy without split controls", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              name: "",
              price: "",
              splitMode: "even",
              allocations: buildRecord().values.items[0].allocations.map((allocation) => ({
                ...allocation,
                evenIncluded: false,
              })),
            },
          ],
        },
      }),
    ];

    render(<AssignItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("Edit Item")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. Truffle Pasta")).toBeTruthy();
    expect(screen.queryByText("Shares")).toBeNull();
    expect(screen.queryByText("Percent")).toBeNull();
  });

  it("renders split-item loading and missing-item branches", () => {
    mockStoreState.records = [];
    const { rerender } = render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("Loading draft")).toBeTruthy();

    mockStoreState.records = [buildRecord({ values: { ...buildRecord().values, items: [] } })];
    rerender(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("Item missing")).toBeTruthy();
  });

  it("keeps split changes local until confirm, supports even mode controls, and advances to the next item", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              allocations: buildRecord().values.items[0].allocations.map((allocation) => ({
                ...allocation,
                evenIncluded: false,
              })),
            },
            {
              ...buildRecord().values.items[0],
              id: "item-2",
              name: "Bread",
              allocations: buildRecord().values.items[0].allocations.map((allocation) => ({
                ...allocation,
                evenIncluded: false,
              })),
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.queryByText("Almost there")).toBeNull();
    fireEvent.press(screen.getByText("Confirm & Split Next"));
    expect(screen.getByText("Almost there")).toBeTruthy();
    expect(screen.getByText("Pick at least one person for this item.")).toBeTruthy();
    expect(mockStoreState.saveItemSplit).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    expect(screen.queryByText("Almost there")).toBeNull();

    fireEvent.press(screen.getByLabelText("Include all split participants"));
    expect(mockStoreState.saveItemSplit).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Exclude all split participants"));
    fireEvent.press(screen.getByLabelText("Include all split participants"));
    fireEvent.press(screen.getByLabelText("Toggle even split for Ana"));
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockReplace).toHaveBeenCalledWith("/split/draft-1/overview");

    await act(async () => {
      fireEvent.press(screen.getByText("Confirm & Split Next"));
    });
    expect(mockStoreState.saveItemSplit).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({
        allocations: expect.arrayContaining([
          expect.objectContaining({ participantId: "ana", evenIncluded: false }),
          expect.objectContaining({ participantId: "bruno", evenIncluded: true }),
        ]),
      })
    );
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/split/item-2");
  });

  it("supports shares mode editing, reset, close, and review confirmation on the last item", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], splitMode: "shares" }],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("Confirm & Review")).toBeTruthy();
    fireEvent.press(screen.getByText("Percentage"));
    fireEvent.press(screen.getByText("Even"));
    fireEvent.press(screen.getByText("Shares"));
    fireEvent.press(screen.getByLabelText("Increase shares for Ana"));
    fireEvent.press(screen.getByLabelText("Decrease shares for Bruno"));
    fireEvent.press(screen.getByLabelText("Exclude all split participants"));
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText("Include all split participants"));
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText("Close"));
    expect(mockReplace).toHaveBeenCalledWith("/");

    await act(async () => {
      fireEvent.press(screen.getByText("Confirm & Review"));
    });
    expect(mockStoreState.saveItemSplit).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ splitMode: "shares" })
    );
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/overview");
  });

  it("uses ALL in shares mode to add one share only to excluded people", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "shares",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "3", percent: "33.34", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "0", percent: "33.33", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "0", percent: "33.33", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.press(screen.getByLabelText("Include all split participants"));
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("supports percent mode editing, keeps excluded people out, and shows the branded split notice", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "33.34", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "66.66", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent(screen.getByLabelText("Percent slider for Ana"), "valueChange", 75);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "75");
    await waitFor(() => {
      expect(screen.getByText("Total: 100%")).toBeTruthy();
    });
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "101");
    await waitFor(() => {
      expect(screen.getByText("Almost there")).toBeTruthy();
      expect(screen.getByText("This item is already fully split. Lower someone else's percent first.")).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "hello");
    await waitFor(() => {
      expect(screen.getByText("Enter a valid percentage.")).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), " ");
    expect(screen.getByLabelText("Percent for Ana").props.value).toBe(" ");
    fireEvent.press(screen.getByLabelText("Exclude all split participants"));
    expect(screen.getByText("Total: 0%")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "40");
    await waitFor(() => {
      expect(screen.getByText("Total: 40%")).toBeTruthy();
      expect(screen.getByLabelText("Percent for Ana").props.value).toBe("40");
    });
    expect(screen.getAllByDisplayValue("0").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("0");
    fireEvent.press(screen.getByLabelText("Use remaining percent for Ana"));
    await waitFor(() => {
      expect(screen.getByLabelText("Percent for Ana").props.value).toBe("100");
      expect(screen.getByText("Total: 100%")).toBeTruthy();
    });
  });

  it("uses ALL to fill only the missing percent across currently excluded people", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.press(screen.getByLabelText("Include all split participants"));
    await waitFor(() => {
      expect(screen.getByLabelText("Percent for Ana").props.value).toBe("50");
      expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("25");
      expect(screen.getByLabelText("Percent for Zoe").props.value).toBe("25");
      expect(screen.getByText("Total: 100%")).toBeTruthy();
    });
  });

  it("keeps percent ALL as a no-op when there is no missing space or nobody is excluded", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.press(screen.getByLabelText("Include all split participants"));
    await waitFor(() => {
      expect(screen.getByLabelText("Percent for Ana").props.value).toBe("50");
      expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("50");
      expect(screen.getByLabelText("Percent for Zoe").props.value).toBe("0");
      expect(screen.getByText("Total: 100%")).toBeTruthy();
    });
  });

  it("distributes leftover percentage remainders deterministically when ALL fills excluded people", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "33.33", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.press(screen.getByLabelText("Include all split participants"));
    await waitFor(() => {
      expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("33.34");
      expect(screen.getByLabelText("Percent for Zoe").props.value).toBe("33.33");
      expect(screen.getByText("Total: 100%")).toBeTruthy();
    });
  });

  it("keeps inactive percent participants excluded without changing other assigned people", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "40", percentLocked: true },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "60", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    const { rerender } = render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "25");
    expect(screen.getByDisplayValue("25")).toBeTruthy();
    expect(screen.getByDisplayValue("60")).toBeTruthy();
    expect(screen.getByLabelText("Percent for Zoe").props.value).toBe("");

    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "60", percentLocked: true },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    rerender(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "50.5");
    await waitFor(() => {
      expect(screen.getByText("Almost there")).toBeTruthy();
    });
  });

  it("preserves blank excluded percent inputs when nobody else is active", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "40");
    expect(screen.getByDisplayValue("40")).toBeTruthy();
    expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("");
  });

  it("keeps non-blank excluded percent inputs at zero when active people rebalance", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "40", percentLocked: true },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "60", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "25");
    expect(screen.getByLabelText("Percent for Zoe").props.value).toBe("0");
  });

  it("leaves blank percent entries untouched while editing someone else", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "40", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "", percentLocked: true },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "60", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "25");
    await waitFor(() => {
      expect(screen.getByLabelText("Percent for Ana").props.value).toBe("25");
    });
    expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("");
    expect(screen.getByLabelText("Percent for Zoe").props.value).toBe("60");
  });

  it("clamps percent sliders to the remaining share instead of erroring", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "40", percentLocked: true },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent(screen.getByLabelText("Percent slider for Bruno"), "valueChange", 100);
    await waitFor(() => {
      expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("60");
    });
    expect(screen.queryByText("Almost there")).toBeNull();
  });

  it("shows a simple popup when someone tries to add percent after the item is already fully split", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "100", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Bruno"), "10");
    await waitFor(() => {
      expect(screen.getByText("This item is already fully split. Lower someone else's percent first.")).toBeTruthy();
    });
  });

  it("dismisses the keyboard and shows the full-split popup when a percent slider tries to grow with no room left", async () => {
    const dismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "47", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "53", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent(screen.getByLabelText("Percent slider for Bruno"), "valueChange", 80);
    await waitFor(() => {
      expect(screen.getByText("This item is already fully split. Lower someone else's percent first.")).toBeTruthy();
    });
    expect(dismissSpy).toHaveBeenCalled();
    expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("53");
  });

  it("shows the generic percent popup when the entered value is too high but the item is not fully split yet", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "40", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "20", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Zoe"), "50");
    await waitFor(() => {
      expect(screen.getByText("That number is too high. Lower it or add someone else to share the rest.")).toBeTruthy();
    });
  });

  it("rejects percent inputs with more than two decimal places", async () => {
    const dismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "2.345");
    await waitFor(() => {
      expect(screen.getByText("Use no more than 2 decimal places.")).toBeTruthy();
    });
    expect(dismissSpy).toHaveBeenCalled();
    expect(screen.getByLabelText("Percent for Ana").props.value).toBe("0");
  });

  it("accepts comma decimals for percentages and normalizes them to dots", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "2,25");
    await waitFor(() => {
      expect(screen.getByLabelText("Percent for Ana").props.value).toBe("2.25");
    });
    expect(screen.queryByText("Almost there")).toBeNull();
  });

  it("keeps unsaved split values per mode while switching between tabs", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: false, shares: "0", percent: "0", percentLocked: false },
                { participantId: "bruno", evenIncluded: false, shares: "0", percent: "0", percentLocked: false },
                { participantId: "zoe", evenIncluded: false, shares: "0", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "25");
    expect(screen.getByLabelText("Percent for Ana").props.value).toBe("25");

    fireEvent.press(screen.getByText("Shares"));
    fireEvent.press(screen.getByLabelText("Increase shares for Bruno"));
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);

    fireEvent.press(screen.getByText("Percentage"));
    expect(screen.getByLabelText("Percent for Ana").props.value).toBe("25");
  });

  it("keeps a trailing decimal separator visible while editing percentages", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "2,");
    expect(screen.getByLabelText("Percent for Ana").props.value).toBe("2,");
    fireEvent.changeText(screen.getByLabelText("Percent for Bruno"), "3.");
    expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("3.");
  });

  it("normalizes trailing decimal separators on percent submit and blur", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Ana"), "12,");
    fireEvent(screen.getByLabelText("Percent for Ana"), "submitEditing");
    expect(screen.getByLabelText("Percent for Ana").props.value).toBe("12");

    fireEvent.changeText(screen.getByLabelText("Percent for Bruno"), "7.");
    fireEvent(screen.getByLabelText("Percent for Bruno"), "blur");
    expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("7");

    fireEvent.changeText(screen.getByLabelText("Percent for Zoe"), "5");
    fireEvent(screen.getByLabelText("Percent for Zoe"), "blur");
    expect(screen.getByLabelText("Percent for Zoe").props.value).toBe("5");
  });

  it("normalizes trailing decimal separators when confirming a percent split", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "2,", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "98", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText("Confirm & Review"));
    });
    expect(mockStoreState.saveItemSplit).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({
        allocations: expect.arrayContaining([
          expect.objectContaining({ participantId: "ana", percent: "2" }),
          expect.objectContaining({ participantId: "bruno", percent: "98" }),
        ]),
      })
    );
  });

  it("shows a dedicated message for negative percentage values", async () => {
    const dismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "25", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "25", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.changeText(screen.getByLabelText("Percent for Bruno"), "-5");
    await waitFor(() => {
      expect(screen.getByText("Percent can't be negative.")).toBeTruthy();
    });
    expect(dismissSpy).toHaveBeenCalled();
    expect(screen.getByLabelText("Percent for Bruno").props.value).toBe("25");
  });

  it("renders percent split totals with zero percentages and invalid prices as zero allocated", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              price: "oops",
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "100", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("Total: 100%")).toBeTruthy();
    expect(screen.getAllByText(/Allocated:\s*(0,00|€0.00|\$0.00|EUR 0.00)/).length).toBeGreaterThan(0);
  });

  it("formats non-integer percent totals without trailing zeros", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "67", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "16.5", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "16", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("Total: 99.5%")).toBeTruthy();
  });

  it("handles split items that are hidden from the visible list and participants without an allocation", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          participants: [
            ...buildRecord().values.participants,
            { id: "mia", name: "Mia" },
          ],
          items: [
            {
              ...buildRecord().values.items[0],
              name: "",
              price: "",
              category: "",
              allocations: buildRecord().values.items[0].allocations,
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getByText("Untitled item")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText("Confirm & Review"));
    });
    expect(mockStoreState.saveItemSplit).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ id: "item-1" })
    );
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/overview");
  });

  it("renders zero-share summaries and clamps share decrements at zero", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              splitMode: "shares",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "0", percent: "50", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "0", percent: "50", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "0", percent: "0", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getAllByText("Total shares").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText("Decrease shares for Ana"));
    expect(mockStoreState.saveItemSplit).not.toHaveBeenCalled();
  });

  it("renders share summaries with invalid prices as zero and shows the even-mode exclusion copy", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              price: "oops",
              splitMode: "shares",
            },
            {
              ...buildRecord().values.items[0],
              id: "item-even",
              name: "Even item",
              allocations: buildRecord().values.items[0].allocations.map((allocation) => ({
                ...allocation,
                evenIncluded: false,
              })),
            },
          ],
        },
      }),
    ];

    const { rerender } = render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    expect(screen.getAllByText(/0,00|€0.00|\$0.00|EUR 0.00/).length).toBeGreaterThan(0);

    rerender(<SplitItemScreen draftId="draft-1" itemId="item-even" />);
    expect(screen.getAllByText("Tap to include").length).toBeGreaterThan(0);
  });

});

