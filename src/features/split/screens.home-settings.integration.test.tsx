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

  it("renders home empty and populated states, and starts a new split", () => {
    mockStoreState.records = [];
    const { rerender } = render(<HomeScreen />);
    expect(screen.getByText("No splits yet")).toBeTruthy();
    expect(screen.getByText("You are owed")).toBeTruthy();
    expect(screen.getByText("You owe")).toBeTruthy();
    expect(screen.getByText("Splits")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();

    const store = require("./store");
    store.getSettlementPreview.mockImplementation((record: any) => {
      if (!record) {
        return null;
      }

      if (record.id === "completed-owed") {
        return {
          ok: true,
          data: {
            currency: "USD",
            totalCents: 8400,
            itemBreakdown: [],
            people: [
              { participantId: "ana", name: "Ana", isPayer: true, paidCents: 8400, consumedCents: 0, netCents: 8400 },
              { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: 4200, netCents: -4200 },
              { participantId: "zoe", name: "Zoe", isPayer: false, paidCents: 0, consumedCents: 4200, netCents: -4200 },
            ],
            transfers: [],
          },
        };
      }

      if (record.id === "pending-owe") {
        return {
          ok: true,
          data: {
            currency: "USD",
            totalCents: 4550,
            itemBreakdown: [],
            people: [
              { participantId: "ana", name: "Ana", isPayer: true, paidCents: 0, consumedCents: 4550, netCents: -4550 },
              { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 4550, consumedCents: 0, netCents: 4550 },
            ],
            transfers: [],
          },
        };
      }

      if (record.id === "draft-no-payer") {
        return {
          ok: true,
          data: {
            currency: "USD",
            totalCents: 0,
            itemBreakdown: [],
            people: [
              { participantId: "ana", name: "Ana", isPayer: false, paidCents: 0, consumedCents: 0, netCents: 0 },
            ],
            transfers: [],
          },
        };
      }

      return null;
    });

    mockStoreState.records = [
      buildRecord({
        id: "completed-owed",
        status: "completed",
        values: { ...buildRecord().values, items: [{ ...buildRecord().values.items[0], name: "Balthazar Dinner" }] },
      }),
      buildRecord({
        id: "pending-owe",
        step: 3,
        values: {
          ...buildRecord().values,
          participants: [
            { id: "ana", name: "Ana" },
            { id: "bruno", name: "Bruno" },
          ],
          items: [{ ...buildRecord().values.items[0], name: "Whole Foods" }],
        },
      }),
      buildRecord({
        id: "movie-night",
        step: 5,
        values: { ...buildRecord().values, items: [{ ...buildRecord().values.items[0], name: "Movie Night" }] },
      }),
      buildRecord({
        id: "draft-no-payer",
        step: 4,
        values: {
          ...buildRecord().values,
          participants: [
            { id: "ana", name: "Ana" },
            { id: "bruno", name: "Bruno" },
          ],
          payerParticipantId: "",
          items: [{ ...buildRecord().values.items[0], name: "No Payer Yet" }],
        },
      }),
      buildRecord({
        id: "draft-no-items",
        step: 4,
        values: {
          ...buildRecord().values,
          participants: [
            { id: "ana", name: "Ana" },
            { id: "bruno", name: "Bruno" },
          ],
          payerParticipantId: "ana",
          items: [],
        },
      }),
      buildRecord({
        id: "coffee-run",
        step: 5,
        values: {
          ...buildRecord().values,
          participants: [
            { id: "ana", name: "Ana" },
            { id: "bruno", name: "Bruno" },
          ],
          items: [{ ...buildRecord().values.items[0], name: "Coffee Run" }],
        },
      }),
    ];
    rerender(<HomeScreen />);
    expect(screen.getByText("Split Bill")).toBeTruthy();
    expect(screen.getByText("Recent")).toBeTruthy();
    expect(screen.getByText("View All")).toBeTruthy();
    expect(screen.getByText("Settled")).toBeTruthy();
    expect(screen.getAllByText("Pending: Items").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending: Split").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending: Payer").length).toBeGreaterThan(0);
    expect(screen.getByText(/\+.*84/)).toBeTruthy();
    expect(screen.getByText("You owe")).toBeTruthy();
    expect(screen.getAllByText(/0[,.]00/).length).toBeGreaterThan(0);
  });

  it("hides home balances when the balance feature is disabled", () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      balanceFeatureEnabled: false,
      defaultCurrency: "EUR",
    };

    render(<HomeScreen />);
    expect(screen.queryByText("You are owed")).toBeNull();
    expect(screen.queryByText("You owe")).toBeNull();
  });

  it("computes home balances for a debtor owner and falls back to zero when the owner is not in a bill", () => {
    const store = require("./store");
    store.getSettlementPreview.mockImplementation((record: any) => {
      if (!record) {
        return null;
      }

      if (record.id === "owner-debtor") {
        return {
          ok: true,
          data: {
            currency: "USD",
            totalCents: 4550,
            itemBreakdown: [],
            people: [
              { participantId: "ana", name: "Ana", isPayer: true, paidCents: 4550, consumedCents: 0, netCents: 4550 },
              { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: 4550, netCents: -4550 },
            ],
            transfers: [],
          },
        };
      }

      return {
        ok: true,
        data: {
          currency: "USD",
          totalCents: 1200,
          itemBreakdown: [],
          people: [
            { participantId: "ana", name: "Ana", isPayer: true, paidCents: 1200, consumedCents: 0, netCents: 1200 },
            { participantId: "zoe", name: "Zoe", isPayer: false, paidCents: 0, consumedCents: 1200, netCents: -1200 },
          ],
          transfers: [],
        },
      };
    });

    mockStoreState.settings = {
      ownerName: "Bruno",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
    };
    mockStoreState.records = [buildRecord({ id: "owner-debtor" })];
    const { rerender } = render(<HomeScreen />);
    expect(screen.getAllByText(/45,50|45.50/).length).toBeGreaterThan(0);
    expect(screen.getByText(/-45,50|-45.50/)).toBeTruthy();

    mockStoreState.settings = {
      ownerName: "Tiago",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
    };
    mockStoreState.records = [buildRecord({ id: "owner-missing" })];
    rerender(<HomeScreen />);
    expect(screen.getByText("Pending: Setup")).toBeTruthy();
    expect(screen.getAllByText(/0,00|0.00/).length).toBeGreaterThan(0);
  });

  it("handles missing settlement state, settled debtors, and zero-net owners on home balances", () => {
    const store = require("./store");
    store.getSettlementPreview.mockImplementation((record: any) => {
      if (!record) {
        return null;
      }

      return {
        ok: true,
        data: {
          currency: "EUR",
          totalCents: 600,
          itemBreakdown: [],
          people: [
            { participantId: "ana", name: "Ana", isPayer: true, paidCents: 600, consumedCents: 300, netCents: 300 },
            { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: 300, netCents: -300 },
            { participantId: "zoe", name: "Zoe", isPayer: false, paidCents: 0, consumedCents: 0, netCents: 0 },
          ],
          transfers: [],
        },
      };
    });

    mockStoreState.settings = {
      ownerName: "Bruno",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
    };
    mockStoreState.records = [
      buildRecord({
        id: "settled-owner",
        settlementState: {
          settledParticipantIds: ["bruno"],
        },
      }),
    ];
    const { rerender } = render(<HomeScreen />);
    expect(screen.getByText("You owe")).toBeTruthy();
    expect(screen.getAllByText(/0,00|€0.00|\$0.00|EUR 0.00/).length).toBeGreaterThan(0);

    mockStoreState.settings = {
      ownerName: "Zoe",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
    };
    mockStoreState.records = [
      buildRecord({
        id: "zero-net-owner",
        settlementState: undefined,
      }),
    ];
    rerender(<HomeScreen />);
    expect(screen.getAllByText(/0,00|€0.00|\$0.00|EUR 0.00/).length).toBeGreaterThan(0);
  });

  it("preserves payer debt direction in home balances and recent rows when the payer owes others", () => {
    const store = require("./store");
    store.getSettlementPreview.mockImplementation((record: any) => {
      if (!record) {
        return null;
      }

      return {
        ok: true,
        data: {
          currency: "EUR",
          totalCents: 200,
          itemBreakdown: [],
          people: [
            { participantId: "ana", name: "Ana", isPayer: true, paidCents: 200, consumedCents: 350, netCents: -150 },
            { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: -50, netCents: 50 },
            { participantId: "zoe", name: "Zoe", isPayer: false, paidCents: 0, consumedCents: 150, netCents: 100 },
          ],
          transfers: [],
        },
      };
    });

    mockStoreState.settings = {
      ownerName: "Ana",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
    };
    mockStoreState.records = [buildRecord({ id: "reverse-payer" })];

    render(<HomeScreen />);

    expect(screen.getByText("You owe")).toBeTruthy();
    expect(screen.getByText(/-1,50|-1.50/)).toBeTruthy();
  });

  it("shows the owner as owed when a non-payer creditor is due money from the payer", () => {
    const store = require("./store");
    store.getSettlementPreview.mockImplementation((record: any) => {
      if (!record) {
        return null;
      }

      return {
        ok: true,
        data: {
          currency: "EUR",
          totalCents: 200,
          itemBreakdown: [],
          people: [
            { participantId: "ana", name: "Ana", isPayer: true, paidCents: 200, consumedCents: 350, netCents: -150 },
            { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: -50, netCents: 50 },
            { participantId: "zoe", name: "Zoe", isPayer: false, paidCents: 0, consumedCents: 150, netCents: 100 },
          ],
          transfers: [],
        },
      };
    });

    mockStoreState.settings = {
      ownerName: "Bruno",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
    };
    mockStoreState.records = [buildRecord({ id: "reverse-creditor" })];

    render(<HomeScreen />);

    expect(screen.getByText("You are owed")).toBeTruthy();
    expect(screen.getByText(/\+0,50|\+0.50/)).toBeTruthy();
  });

  it("scopes home balances to the selected default currency when records mix currencies", () => {
    const store = require("./store");
    store.getSettlementPreview.mockImplementation((record: any) => {
      if (!record) {
        return null;
      }

      if (record.id === "usd-record") {
        return {
          ok: true,
          data: {
            currency: "USD",
            totalCents: 1200,
            itemBreakdown: [],
            people: [
              { participantId: "ana", name: "Ana", isPayer: true, paidCents: 1200, consumedCents: 0, netCents: 1200 },
              { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: 1200, netCents: -1200 },
            ],
            transfers: [],
          },
        };
      }

      return {
        ok: true,
        data: {
          currency: "EUR",
          totalCents: 300,
          itemBreakdown: [],
          people: [
            { participantId: "ana", name: "Ana", isPayer: true, paidCents: 300, consumedCents: 0, netCents: 300 },
            { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: 300, netCents: -300 },
          ],
          transfers: [],
        },
      };
    });

    mockStoreState.settings = {
      ownerName: "Ana",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };
    mockStoreState.records = [
      buildRecord({ id: "usd-record", values: { ...buildRecord().values, currency: "USD" } }),
      buildRecord({ id: "eur-record" }),
    ];

    render(<HomeScreen />);
    expect(screen.getAllByText(/3,00|3.00/).length).toBeGreaterThan(0);
    expect(screen.queryByText("$12.00")).toBeNull();
  });

  it("covers denied camera/library permissions and custom currency collision fallbacks", async () => {
    const collisionCodes = ["CUR", ...Array.from({ length: 999 }, (_, index) => {
      const suffix = String(index + 1);
      return `${"CUR".slice(0, Math.max(0, 3 - suffix.length))}${suffix}`;
    })];

    mockStoreState.settings = {
      ownerName: "Tiago",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: collisionCodes.map((code, index) => ({
        code,
        name: `Currency ${index}`,
        symbol: `$${index}`,
      })),
    };
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    const createIdSpy = jest.spyOn(domain, "createId").mockReturnValue("!!!");

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));
    fireEvent.press(screen.getByLabelText("Profile picture options"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Upload photo"));
    });
    expect(screen.getByText("Please allow photo access to choose a profile picture.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    fireEvent.press(screen.getByLabelText("Profile picture options"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Take photo"));
    });
    expect(screen.getByText("Please allow camera access to take a profile picture.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Choose default currency"));
    });
    fireEvent.press(screen.getByLabelText("Choose other currency"));
    fireEvent.changeText(screen.getByPlaceholderText("Currency name"), "Cur");
    fireEvent.changeText(screen.getByPlaceholderText("Currency symbol"), "#");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save custom currency"));
    });
    expect(screen.queryByPlaceholderText("Currency name")).toBeNull();
    createIdSpy.mockRestore();
  });

  it("opens completed records, falls back unknown draft routes, and starts a split from the hero card", async () => {
    mockStoreState.records = [
      buildRecord({
        id: "draft-unknown",
        step: 99,
      }),
      buildRecord({
        status: "completed",
        step: 99,
        values: {
          ...buildRecord().values,
          items: [],
        },
      }),
    ];

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Groceries"));
    expect(mockPush).toHaveBeenCalledWith("/split/draft-unknown/overview");

    fireEvent.press(screen.getByText("Untitled split"));
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/results");

    await act(async () => {
      fireEvent.press(screen.getByText("Start New Split"));
    });
    await waitFor(() => {
      expect(mockStoreState.createDraft).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/split/draft-2/setup");
    });
  });

  it("routes completed home records straight to results", () => {
    mockStoreState.records = [
      buildRecord({
        id: "completed-direct",
        status: "completed",
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], name: "Completed direct" }],
        },
      }),
    ];

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Completed direct"));
    expect(mockPush).toHaveBeenCalledWith("/split/completed-direct/results");
  });

  it("queues draft deletion from home, supports undo, and commits after the delay", () => {
    jest.useFakeTimers();
    mockStoreState.records = [
      buildRecord({
        id: "draft-delete-me",
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], name: "Delete Me" }],
        },
      }),
      buildRecord({
        id: "draft-delete-next",
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], name: "Delete Next" }],
        },
      }),
    ];

    const view = render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Delete split Delete Me"));
    expect(screen.getByText("Draft deleted")).toBeTruthy();
    expect(screen.queryByLabelText("Delete split Delete Me")).toBeNull();
    expect(mockStoreState.removeRecord).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith("/split/draft-delete-me/overview");

    fireEvent.press(screen.getByLabelText("Undo delete"));
    expect(screen.queryByText("Draft deleted")).toBeNull();
    expect(screen.getByLabelText("Delete split Delete Me")).toBeTruthy();
    expect(mockStoreState.removeRecord).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText("Delete split Delete Me"));
    fireEvent.press(screen.getByLabelText("Delete split Delete Next"));
    expect(mockStoreState.removeRecord).toHaveBeenCalledWith("draft-delete-me");
    expect(screen.queryByLabelText("Delete split Delete Next")).toBeNull();

    view.unmount();
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(mockStoreState.removeRecord).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("commits a queued home deletion after the undo window expires", async () => {
    jest.useFakeTimers();
    mockStoreState.records = [
      buildRecord({
        id: "draft-expire-delete",
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], name: "Expire Delete" }],
        },
      }),
    ];

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Delete split Expire Delete"));
    expect(screen.getByText("Draft deleted")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    expect(mockStoreState.removeRecord).toHaveBeenCalledWith("draft-expire-delete");
    expect(screen.queryByText("Draft deleted")).toBeNull();
    jest.useRealTimers();
  });

  it("derives the home pending stage from current record validity instead of stale stored step metadata", () => {
    mockStoreState.records = [
      buildRecord({
        id: "draft-stale-payer",
        step: 2,
        values: {
          ...buildRecord().values,
          participants: [],
          payerParticipantId: "",
        },
      }),
    ];

    render(<HomeScreen />);
    expect(screen.getByText("Pending: Participants")).toBeTruthy();

    fireEvent.press(screen.getByText("Groceries"));
    expect(mockPush).toHaveBeenCalledWith("/split/draft-stale-payer/participants");
  });

  it("keeps a valid-but-not-advanced draft on participants from home until the user reaches payer", () => {
    mockStoreState.records = [
      buildRecord({
        id: "draft-not-advanced",
        step: 1,
        values: {
          ...buildRecord().values,
          participants: [
            { id: "ana", name: "Ana" },
            { id: "bruno", name: "Bruno" },
          ],
          payerParticipantId: "",
          items: [],
        },
      }),
    ];

    render(<HomeScreen />);
    expect(screen.getByText("Pending: Setup")).toBeTruthy();

    fireEvent.press(screen.getByText("Untitled split"));
    expect(mockPush).toHaveBeenCalledWith("/split/draft-not-advanced/setup");
  });

  it("falls back to participants from home when a draft stores a non-finite step value", () => {
    mockStoreState.records = [
      buildRecord({
        id: "draft-nan-step",
        step: Number.NaN,
        values: {
          ...buildRecord().values,
          participants: [
            { id: "ana", name: "Ana" },
            { id: "bruno", name: "Bruno" },
          ],
          payerParticipantId: "",
          items: [],
        },
      }),
    ];

    render(<HomeScreen />);
    expect(screen.getByText("Pending: Setup")).toBeTruthy();
  });

  it("opens the splits tab from view all, filters records, and loads more rows on demand", () => {
    const splitRecords = Array.from({ length: 22 }, (_, index) =>
      buildRecord({
        id: `split-${index + 1}`,
        status: index % 2 === 0 ? "completed" : "draft",
        updatedAt: `2026-04-${String(22 - index).padStart(2, "0")}T10:00:00.000Z`,
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], name: `Split ${index + 1}` }],
        },
      })
    );
    mockStoreState.records = splitRecords;

    const view = render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("View all splits"));
    expect(screen.getAllByText("Splits").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Show filters")).toBeTruthy();
    expect(screen.queryByText("Filters")).toBeNull();
    expect(screen.getByText("Split 1")).toBeTruthy();
    expect(screen.queryByText("Split 21")).toBeNull();

    let list = view.UNSAFE_root.find((node: any) => typeof node.props.onScroll === "function");
    act(() => {
      list.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 100 },
          layoutMeasurement: { height: 800 },
          contentSize: { height: 1900 },
        },
      });
    });
    expect(screen.queryByText("Split 21")).toBeNull();
    act(() => {
      list.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 1000 },
          layoutMeasurement: { height: 800 },
          contentSize: { height: 1900 },
        },
      });
    });
    expect(screen.getByText("Split 21")).toBeTruthy();
    act(() => {
      list.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 1100 },
          layoutMeasurement: { height: 800 },
          contentSize: { height: 1900 },
        },
      });
    });
    list = view.UNSAFE_root.find((node: any) => typeof node.props.onScroll === "function");
    expect(list).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Show filters"));
    expect(screen.getByText("Filters")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Settled"));
    expect(screen.getByText("Split 1")).toBeTruthy();
    expect(screen.queryByText("Split 2")).toBeNull();

    fireEvent.press(screen.getByLabelText("Unsettled"));
    expect(screen.getByText("Split 2")).toBeTruthy();
    expect(screen.queryByText("Split 1")).toBeNull();

    fireEvent.press(screen.getByLabelText("Oldest"));
    expect(screen.getByText("Split 22")).toBeTruthy();
  });

  it("shows the empty state on the splits tab when no records match", () => {
    mockStoreState.records = [];
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("View all splits"));
    expect(screen.getByText("No splits here")).toBeTruthy();
  });

  it("renders settings drafts, opens profile actions, and saves everything together", async () => {
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///camera-profile.png" }] as any,
    });

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));
    expect(screen.getByText("User profile")).toBeTruthy();
    expect(screen.getByText("Default currency")).toBeTruthy();
    expect(screen.getByText("Balance helper")).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "Tiago");
    fireEvent.press(screen.getByLabelText("Profile picture options"));
    expect(screen.getByText("Profile picture")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Take photo"));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Toggle balance helper"));
    });
    expect(mockStoreState.updateSettings).not.toHaveBeenCalledWith({
      balanceFeatureEnabled: false,
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });
    expect(mockStoreState.updateSettings).toHaveBeenLastCalledWith({
      ownerName: "Tiago",
      ownerProfileImageUri: "file:///camera-profile.png",
      balanceFeatureEnabled: false,
      trackPaymentsFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    });
  });

  it("shows settings validation popups and supports custom/default currency updates", async () => {
    mockStoreState.settings = {
      ownerName: "Tiago",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "",
      customCurrencies: [{ code: "POI", name: "Points", symbol: "P" }],
    };
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Toggle balance helper"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });
    expect(screen.getByText("Please choose a default currency first.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "Tiago");
    fireEvent.press(screen.getByLabelText("Profile picture options"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Upload photo"));
    });
    expect(screen.getByText("Please allow photo access to choose a profile picture.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    fireEvent.press(screen.getByLabelText("Profile picture options"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Take photo"));
    });
    expect(screen.getByText("Please allow camera access to take a profile picture.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });
    expect(screen.getByText("Please choose a default currency first.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Choose default currency"));
    });
    fireEvent.press(screen.getByLabelText("Choose other currency"));
    fireEvent.changeText(screen.getByPlaceholderText("Currency name"), "Points");
    fireEvent.changeText(screen.getByPlaceholderText("Currency symbol"), "P");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save custom currency"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });
    expect(mockStoreState.updateSettings).toHaveBeenLastCalledWith({
      ownerName: "Tiago",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: false,
      trackPaymentsFeatureEnabled: true,
      defaultCurrency: "PO2",
      customCurrencies: [
        { code: "POI", name: "Points", symbol: "P" },
        { code: "PO2", name: "Points", symbol: "P" },
      ],
      });
    });

    it("shows a simple popup for a missing profile name and ignores canceled image picking", async () => {
      mockStoreState.settings = {
        ownerName: "You",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "   ");

    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });
    expect(screen.getByText("Please choose a short name for yourself.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    fireEvent.press(screen.getByLabelText("Profile picture options"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Upload photo"));
    });
    expect(mockStoreState.updateSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ ownerProfileImageUri: expect.any(String) })
    );
  });

  it("builds a fallback custom currency code, removes photos, and prompts to save or discard", async () => {
    mockStoreState.settings = {
      ownerName: "Tiago",
      ownerProfileImageUri: "file:///existing.png",
      balanceFeatureEnabled: false,
      defaultCurrency: "EUR",
      customCurrencies: undefined,
    };

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));
    expect(screen.getByText("Off")).toBeTruthy();
    expect(screen.queryByText("You are owed")).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Toggle balance helper"));
    });
    fireEvent.press(screen.getByLabelText("Open Splits"));
    expect(screen.getByText("Save your changes?")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Discard changes"));
    expect(screen.queryByText("You are owed")).toBeNull();
    fireEvent.press(screen.getByLabelText("Open Settings"));

    fireEvent.press(screen.getByLabelText("Profile picture options"));
    fireEvent.press(screen.getByLabelText("Remove photo"));

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Choose default currency"));
    });
    fireEvent.press(screen.getByLabelText("Choose other currency"));
    fireEvent.changeText(screen.getByPlaceholderText("Currency name"), "123");
    fireEvent.changeText(screen.getByPlaceholderText("Currency symbol"), "#");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save custom currency"));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Toggle balance helper"));
    });
    fireEvent.press(screen.getByLabelText("Open Home"));
    expect(screen.getByText("Save your changes?")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save changes"));
    });
    expect(mockStoreState.updateSettings).toHaveBeenLastCalledWith({
      ownerName: "Tiago",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      trackPaymentsFeatureEnabled: true,
      defaultCurrency: "CUR",
      customCurrencies: [{ code: "CUR", name: "123", symbol: "#" }],
    });
  });

  it("lets settings choose preset currencies, cancel profile actions, and cancel custom currency creation", async () => {
    mockStoreState.settings = {
      ownerName: "Tiago",
      ownerProfileImageUri: "file:///existing.png",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));

    fireEvent.press(screen.getByLabelText("Profile picture options"));
    fireEvent.press(screen.getByLabelText("Cancel"));
    expect(screen.queryByText("Profile picture")).toBeNull();

    fireEvent.press(screen.getByLabelText("Choose default currency"));
    fireEvent.press(screen.getByText("US Dollar ($)"));
    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });
    expect(mockStoreState.updateSettings).toHaveBeenLastCalledWith({
      ownerName: "Tiago",
      ownerProfileImageUri: "file:///existing.png",
      balanceFeatureEnabled: true,
      trackPaymentsFeatureEnabled: true,
      defaultCurrency: "USD",
      customCurrencies: [],
    });

    fireEvent.press(screen.getByLabelText("Choose default currency"));
    fireEvent.press(screen.getByLabelText("Choose other currency"));
    fireEvent.press(screen.getByLabelText("Cancel custom currency"));
    expect(screen.queryByPlaceholderText("Currency name")).toBeNull();
  });

  it("keeps the user on settings when they choose to stay and shows the custom-currency validation popup", async () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Choose default currency"));
    });
    fireEvent.press(screen.getByLabelText("Choose other currency"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save custom currency"));
    });
    expect(screen.getByText("Please add a currency name first.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "Tiago!");
    fireEvent.press(screen.getByLabelText("Open Home"));
    expect(screen.getByText("Save your changes?")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Discard changes"));
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
    expect(screen.queryByText("Save your changes?")).toBeNull();
  });

  it("moves through custom currency inputs and clears validation highlights once the user fixes them", async () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Choose default currency"));
    });
    fireEvent.press(screen.getByLabelText("Choose other currency"));

    const nameInput = screen.getByPlaceholderText("Currency name");
    const symbolInput = screen.getByPlaceholderText("Currency symbol");

    fireEvent(nameInput, "submitEditing");
    fireEvent.changeText(nameInput, "");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save custom currency"));
    });
    expect(screen.getByText("Please add a currency name first.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    fireEvent.changeText(nameInput, "Tokens");
    fireEvent(symbolInput, "submitEditing");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save custom currency"));
    });
    expect(screen.getByText("Please add a currency symbol too.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));

    fireEvent.changeText(symbolInput, "T");
    await act(async () => {
      fireEvent(symbolInput, "submitEditing");
    });
    expect(screen.queryByPlaceholderText("Currency name")).toBeNull();
  });

  it("caps the custom currency symbol at 3 characters", async () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Choose default currency"));
    });
    fireEvent.press(screen.getByLabelText("Choose other currency"));

    fireEvent.changeText(screen.getByPlaceholderText("Currency name"), "Token");
    fireEvent.changeText(screen.getByPlaceholderText("Currency symbol"), "ABCD");

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save custom currency"));
    });

    expect(screen.queryByPlaceholderText("Currency name")).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });
    await waitFor(() => {
      expect(mockStoreState.updateSettings).toHaveBeenLastCalledWith({
        ownerName: "Ana",
        ownerProfileImageUri: "",
        balanceFeatureEnabled: true,
        trackPaymentsFeatureEnabled: true,
        defaultCurrency: "TOK",
        customCurrencies: [{ code: "TOK", name: "Token", symbol: "ABC" }],
      });
    });
  });

  it("dismisses the profile action sheet from the backdrop", () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));
    fireEvent.press(screen.getByLabelText("Profile picture options"));
    expect(screen.getByText("Profile picture")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss action sheet"));
    expect(screen.queryByText("Profile picture")).toBeNull();
  });

  it("falls back to blank-safe settings defaults and keeps the leave modal open when save fails", async () => {
    mockStoreState.settings = {
      ownerName: undefined,
      ownerProfileImageUri: undefined,
      balanceFeatureEnabled: true,
      defaultCurrency: undefined,
      customCurrencies: undefined,
    };

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Settings"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "");
    expect(screen.getByText("?")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Toggle balance helper"));
    });
    fireEvent.press(screen.getByLabelText("Open Home"));
    expect(screen.getByText("Save your changes?")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save changes"));
    });
    expect(screen.getByText("Please choose a short name for yourself.")).toBeTruthy();
    expect(screen.getByText("Save your changes?")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Discard changes"));
    expect(screen.queryByText("Save your changes?")).toBeNull();
  });

  it("formats custom-currency home balances through the fallback symbol path", () => {
    const store = require("./store");
    store.getSettlementPreview.mockImplementation((record: any) =>
      record
        ? {
            ok: true,
            data: {
              currency: "PTS",
              totalCents: 1234,
              itemBreakdown: [],
              people: [
                { participantId: "ana", name: "Ana", isPayer: true, paidCents: 1234, consumedCents: 0, netCents: 1234 },
              ],
              transfers: [],
            },
          }
        : null
    );
    mockStoreState.settings = {
      ownerName: "Ana",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "PTS",
      customCurrencies: [{ code: "PTS", name: "Points", symbol: "P" }],
    };
    mockStoreState.records = [buildRecord({ values: { ...buildRecord().values, currency: "PTS" } })];

    render(<HomeScreen />);
    expect(screen.getAllByText("P0.00").length).toBeGreaterThan(0);
  });

  it("falls back to a code label when home money formatting throws", () => {
    const originalNumberFormat = Intl.NumberFormat;
    try {
      // @ts-expect-error test override
      Intl.NumberFormat = jest.fn(() => {
        throw new Error("boom");
      });

      mockStoreState.settings = {
        ownerName: "Ana",
        ownerProfileImageUri: "",
        balanceFeatureEnabled: true,
        defaultCurrency: "EUR",
        customCurrencies: [],
      };
      mockStoreState.records = [buildRecord()];

      render(<HomeScreen />);
      expect(screen.getAllByText("EUR 6.00").length).toBeGreaterThan(0);
      expect(screen.getAllByText("EUR 0.00").length).toBeGreaterThan(0);
    } finally {
      Intl.NumberFormat = originalNumberFormat;
    }
  });

});

