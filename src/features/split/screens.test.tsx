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
    fireEvent.press(screen.getByLabelText("Delete draft Delete Me"));
    expect(screen.getByText("Draft deleted")).toBeTruthy();
    expect(screen.queryByLabelText("Delete draft Delete Me")).toBeNull();
    expect(mockStoreState.removeRecord).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith("/split/draft-delete-me/overview");

    fireEvent.press(screen.getByLabelText("Undo delete"));
    expect(screen.queryByText("Draft deleted")).toBeNull();
    expect(screen.getByLabelText("Delete draft Delete Me")).toBeTruthy();
    expect(mockStoreState.removeRecord).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText("Delete draft Delete Me"));
    fireEvent.press(screen.getByLabelText("Delete draft Delete Next"));
    expect(mockStoreState.removeRecord).toHaveBeenCalledWith("draft-delete-me");
    expect(screen.queryByLabelText("Delete draft Delete Next")).toBeNull();

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
    fireEvent.press(screen.getByLabelText("Delete draft Expire Delete"));
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

    fireEvent.press(screen.getByText("Save Settings"));
    expect(mockStoreState.updateSettings).toHaveBeenLastCalledWith({
      ownerName: "Ana",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      trackPaymentsFeatureEnabled: true,
      defaultCurrency: "TOK",
      customCurrencies: [{ code: "TOK", name: "Token", symbol: "ABC" }],
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
    expect(mockStoreState.removeItem).not.toHaveBeenCalled();
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
      fireEvent.press(screen.getByText("Apply import"));
    });
    expect(mockBack).toHaveBeenCalled();
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

  it("renders review loading, pending state, and invalid finalization hints", () => {
    mockStoreState.records = [];
    const { rerender } = render(<ReviewScreen draftId="draft-1" />);
    expect(screen.getByText("Loading draft")).toBeTruthy();

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
          ],
        },
      }),
    ];
    rerender(<ReviewScreen draftId="draft-1" />);
    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getAllByText("Split").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByText("Groceries"));
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/split/item-1");
    fireEvent.press(screen.getByText("Show Results"));
    expect(screen.getByText("Almost there")).toBeTruthy();
    expect(screen.getByText("There are still items left to split before you can see the results.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    expect(screen.queryByText("There are still items left to split before you can see the results.")).toBeNull();
  });

  it("shows the friendly shares warning from the split popup", async () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [{ ...buildRecord().values.items[0], splitMode: "shares" }],
        },
      }),
    ];

    render(<SplitItemScreen draftId="draft-1" itemId="item-1" />);
    fireEvent.press(screen.getByLabelText("Exclude all split participants"));
    await act(async () => {
      fireEvent.press(screen.getByText("Confirm & Review"));
    });
    expect(screen.getByText("Almost there")).toBeTruthy();
    expect(screen.getByText("Add at least one share before you continue.")).toBeTruthy();
  });

  it("renders review progress and proceeds when valid", () => {
    render(<ReviewScreen draftId="draft-1" />);
    expect(screen.getByText("Current progress")).toBeTruthy();
    expect(screen.getByText("Review Items")).toBeTruthy();
    expect(screen.getByText("1 of 1 items assigned")).toBeTruthy();
    expect(screen.queryByText("Total settled")).toBeNull();
    fireEvent.press(screen.getByText("Show Results"));
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/results");
  });

  it("only enables review scrolling when the content overflows the screen", () => {
    render(<ReviewScreen draftId="draft-1" />);

    let reviewScroll = screen.getByTestId("review-scroll");
    expect(reviewScroll.props.scrollEnabled).toBe(false);

    act(() => {
      reviewScroll.props.onLayout({ nativeEvent: { layout: { height: 700 } } });
      reviewScroll.props.onContentSizeChange(320, 620);
    });
    reviewScroll = screen.getByTestId("review-scroll");
    expect(reviewScroll.props.scrollEnabled).toBe(false);

    act(() => {
      reviewScroll.props.onContentSizeChange(320, 920);
    });
    reviewScroll = screen.getByTestId("review-scroll");
    expect(reviewScroll.props.scrollEnabled).toBe(true);
  });

  it("renders review rows for shares and percent items", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              id: "item-shares",
              name: "Bakery",
              splitMode: "shares",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "2", percent: "50", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "0", percent: "50", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "0", percent: "0", percentLocked: false },
              ],
            },
            {
              ...buildRecord().values.items[0],
              id: "item-percent",
              name: "Cabernet",
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "40", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "35", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "25", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<ReviewScreen draftId="draft-1" />);
    expect(screen.getByText("Split by 1")).toBeTruthy();
    expect(screen.getByText("Split by 3")).toBeTruthy();
  });

  it("surfaces pending percent items with invalid totals in review", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              id: "item-percent-invalid",
              name: "Invalid Percent",
              splitMode: "percent",
              allocations: [
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "-10", percentLocked: false },
                { participantId: "bruno", evenIncluded: true, shares: "1", percent: "60", percentLocked: false },
                { participantId: "zoe", evenIncluded: true, shares: "1", percent: "40", percentLocked: false },
              ],
            },
          ],
        },
      }),
    ];

    render(<ReviewScreen draftId="draft-1" />);
    expect(screen.getAllByText("Split").length).toBeGreaterThan(0);
  });

  it("renders percent review rows with zero allocations and assigned invalid totals as zero money", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              id: "item-percent-zero",
              name: "Zero Percent",
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

    render(<ReviewScreen draftId="draft-1" />);
    expect(screen.getByText("Split by 1")).toBeTruthy();
    expect(screen.getAllByText(/0,00|€0.00|\$0.00|EUR 0.00/).length).toBeGreaterThan(0);
  });

  it("routes pending split drafts from home to review instead of jumping directly into an item", () => {
    mockStoreState.records = [
      buildRecord({
        id: "draft-pending-split",
        step: 4,
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
          ],
        },
      }),
    ];

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Groceries"));
    expect(mockPush).toHaveBeenCalledWith("/split/draft-pending-split/items");
  });

  it("routes the review close header action to home", () => {
    render(<ReviewScreen draftId="draft-1" />);
    expect(screen.getByText("Review Items")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockReplace).toHaveBeenCalledWith("/split/draft-1/items");
    fireEvent.press(screen.getByLabelText("Close"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("renders review fallback labels and zero-progress states", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              name: "",
              price: "oops",
              allocations: buildRecord().values.items[0].allocations.map((allocation) => ({
                ...allocation,
                evenIncluded: false,
              })),
            },
          ],
        },
      }),
    ];

    render(<ReviewScreen draftId="draft-1" />);
    expect(screen.getByText("Untitled item")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getAllByText(/0,00|€0.00|\$0.00/).length).toBeGreaterThan(0);
  });

  it("covers overview loading, invalid, valid, and close flows", () => {
    mockStoreState.records = [];
    const { rerender } = render(<OverviewScreen draftId="draft-1" />);
    expect(screen.getByText("Loading draft")).toBeTruthy();

    mockStoreState.records = [buildRecord({ values: { ...buildRecord().values, participants: [] } })];
    rerender(<OverviewScreen draftId="draft-1" />);
    expect(screen.getByText("Not there yet...")).toBeTruthy();
    fireEvent.press(screen.getByText("Finalize Bill"));
    expect(screen.getAllByText("Not there yet...").length).toBeGreaterThan(0);

    mockStoreState.records = [buildRecord()];
    rerender(<OverviewScreen draftId="draft-1" />);
    expect(screen.getByText("Review Items")).toBeTruthy();
    expect(screen.getByText("People totals")).toBeTruthy();
    expect(screen.getByText("Item breakdown")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockBack).toHaveBeenCalled();
    fireEvent.press(screen.getByText("Finalize Bill"));
    expect(mockPush).toHaveBeenCalledWith("/split/draft-1/results");
    fireEvent.press(screen.getByLabelText("Close"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("renders reverse-settlement labels correctly in overview totals", () => {
    const computeSettlementSpy = jest.spyOn(domain, "computeSettlement").mockReturnValueOnce({
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
    });

    render(<OverviewScreen draftId="draft-1" />);
    expect(screen.getAllByText("Payer owes them").length).toBeGreaterThan(0);
    computeSettlementSpy.mockRestore();
  });

  it("renders zero-progress overview and review states when there are no visible items", () => {
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              name: "",
              price: "",
              category: "",
            },
          ],
        },
      }),
    ];

    const overview = render(<OverviewScreen draftId="draft-1" />);
    expect(screen.getByText("Not there yet...")).toBeTruthy();
    overview.unmount();
    render(<ReviewScreen draftId="draft-1" />);
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
  });

  it("routes home drafts with no visible or no pending items back to review", () => {
    mockStoreState.records = [
      buildRecord({
        id: "draft-no-visible-items",
        step: 4,
        values: {
          ...buildRecord().values,
          items: [
            {
              ...buildRecord().values.items[0],
              name: "",
              price: "",
              category: "",
            },
          ],
        },
      }),
      buildRecord({
        id: "draft-all-assigned",
        step: 4,
      }),
    ];

    render(<HomeScreen />);
    fireEvent.press(screen.getAllByText("Untitled split")[0]);
    fireEvent.press(screen.getByText("Groceries"));
    expect(mockPush).toHaveBeenCalledWith("/split/draft-no-visible-items/items");
    expect(mockPush).toHaveBeenCalledWith("/split/draft-all-assigned/items");
  });

  it("renders results loading and invalid branches", () => {
    mockStoreState.records = [];
    const { rerender } = render(<ResultsScreen draftId="draft-1" />);
    expect(screen.getByText("Loading draft")).toBeTruthy();

    const store = require("./store");
    store.getSettlementPreview.mockReturnValueOnce(null);
    store.getClipboardSummaryPreview.mockReturnValueOnce(null);
    mockStoreState.records = [buildRecord()];
    rerender(<ResultsScreen draftId="draft-1" />);
    expect(screen.getByText("Split invalid")).toBeTruthy();
    expect(mockStoreState.markCompleted).not.toHaveBeenCalled();
  });

  it("renders results actions and completion effect", async () => {
    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(mockStoreState.markCompleted).toHaveBeenCalled();
    });
    expect(screen.getByText("Final Results")).toBeTruthy();
    expect(screen.getByText("Paid by")).toBeTruthy();
    expect(screen.getByText("Breakdown")).toBeTruthy();
    expect(screen.getByText("Mark as Paid")).toBeTruthy();
    expect(screen.getAllByText(/3,00|EUR 3.00/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText("Share Results"));
    expect(mockShare).toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Export as PDF"));
    expect(mockSetStringAsync).toHaveBeenCalledWith(expect.stringContaining("split-bill-2026-03-09.pdf"));
  });

  it("supports marking the whole bill as paid and reverting it", async () => {
    const { rerender } = render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(mockStoreState.markCompleted).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByText("Mark as Paid"));
    expect(mockStoreState.markBillPaid).toHaveBeenCalled();

    mockStoreState.records = [
      buildRecord({
        status: "completed",
        step: 5,
        settlementState: {
          settledParticipantIds: ["bruno", "zoe"],
        },
      }),
    ];
    rerender(<ResultsScreen draftId="draft-1" />);
    expect(screen.getByText("Revert Mark as Paid")).toBeTruthy();
    fireEvent.press(screen.getByText("Revert Mark as Paid"));
    expect(mockStoreState.revertBillPaid).toHaveBeenCalled();
  });

  it("does not auto-complete again when the record is already completed", async () => {
    mockStoreState.records = [
      buildRecord({
        status: "completed",
        step: 6,
      }),
    ];

    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(screen.getByText("Final Results")).toBeTruthy();
    });
    expect(screen.getByLabelText("Share Results")).toBeTruthy();
    expect(mockStoreState.markCompleted).not.toHaveBeenCalled();
  });

  it("supports participant-level paid toggles and settled styling", async () => {
    mockStoreState.records = [
      buildRecord({
        status: "completed",
        step: 5,
        settlementState: {
          settledParticipantIds: ["bruno"],
        },
      }),
    ];

    render(<ResultsScreen draftId="draft-1" />);

    expect(screen.getByText("Settled")).toBeTruthy();
    expect(screen.getByText("Owed")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Add Bruno back to owed"));
    expect(mockStoreState.toggleParticipantPaid).toHaveBeenCalledWith("bruno");
    fireEvent.press(screen.getByLabelText("Mark Zoe as paid"));
    expect(mockStoreState.toggleParticipantPaid).toHaveBeenCalledWith("zoe");
  });

  it("renders reverse-settlement breakdowns using the people owed by the payer", async () => {
    const store = require("./store");
    store.getSettlementPreview.mockReturnValueOnce({
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
    });
    mockStoreState.records = [
      buildRecord({
        settlementState: {
          settledParticipantIds: ["bruno"],
        },
      }),
    ];

    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(mockStoreState.markCompleted).toHaveBeenCalled();
    });

    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(screen.getByText("Zoe")).toBeTruthy();
    expect(screen.getByText("Settled")).toBeTruthy();
    expect(screen.getByText("Owed")).toBeTruthy();
  });

  it("hides payment controls on results when track payments is disabled", async () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      balanceFeatureEnabled: true,
      trackPaymentsFeatureEnabled: false,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };

    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(mockStoreState.markCompleted).toHaveBeenCalled();
    });

    expect(screen.queryByText("Mark as Paid")).toBeNull();
    expect(screen.queryByText("Revert Mark as Paid")).toBeNull();
    expect(screen.queryByText("Settled")).toBeNull();
    expect(screen.queryByText("Owed")).toBeNull();
    expect(screen.getByText("Total bill")).toBeTruthy();
  });

  it("keeps payment controls hidden on results when track payments is disabled but still shows balances elsewhere", async () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      balanceFeatureEnabled: true,
      trackPaymentsFeatureEnabled: false,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };

    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(screen.getByText("Final Results")).toBeTruthy();
    });

    expect(screen.queryByText("Mark as Paid")).toBeNull();
    expect(screen.queryByText("Revert Mark as Paid")).toBeNull();
    expect(screen.queryByText("Settled")).toBeNull();
    expect(screen.queryByText("Owed")).toBeNull();
    expect(screen.getByText("Total bill")).toBeTruthy();
  });

  it("shows the new feature rows in settings and saves both balance toggles", async () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Settings"));
    fireEvent.press(screen.getByLabelText("Toggle balance helper"));
    fireEvent.press(screen.getByLabelText("Toggle track payments"));
    fireEvent.press(screen.getByText("Why do I need this?"));
    expect(screen.getByText("Soon")).toBeTruthy();
    expect(screen.getByText("All your Split Bill data lives only on this phone for now. Without backup, losing the phone means losing the data too.")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });

    expect(mockStoreState.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        balanceFeatureEnabled: false,
        trackPaymentsFeatureEnabled: false,
      })
    );
  });

  it("closes the custom currency popup from cancel and clears its validation state", () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Settings"));
    fireEvent.press(screen.getByLabelText("Choose default currency"));
    fireEvent.press(screen.getByLabelText("Choose other currency"));
    fireEvent.changeText(screen.getByPlaceholderText("Currency name"), "");
    fireEvent.changeText(screen.getByPlaceholderText("Currency symbol"), "");
    fireEvent.press(screen.getByLabelText("Save custom currency"));
    expect(screen.getByText("Almost there")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Cancel custom currency"));

    expect(screen.queryByPlaceholderText("Currency name")).toBeNull();

    fireEvent.press(screen.getByLabelText("Choose default currency"));
    fireEvent.press(screen.getByLabelText("Choose other currency"));
    expect(screen.getByPlaceholderText("Currency name").props.value).toBe("");
    expect(screen.getByPlaceholderText("Currency symbol").props.value).toBe("");
  });

  it("defaults missing feature flags to on in settings and restores them on discard", () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      ownerProfileImageUri: "",
      defaultCurrency: "EUR",
      customCurrencies: [],
    } as any;

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Settings"));
    expect(screen.getAllByText("On")).toHaveLength(2);
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "Ana Maria");
    fireEvent.press(screen.getByLabelText("Open Home"));
    fireEvent.press(screen.getByLabelText("Discard changes"));
    fireEvent.press(screen.getByText("Settings"));
    expect(screen.getByPlaceholderText("e.g. Tiago").props.value).toBe("Ana");
    expect(screen.getAllByText("On")).toHaveLength(2);
  });

  it("hides split balances when the balance feature is disabled", () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: false,
      trackPaymentsFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Splits"));
    expect(screen.getByLabelText("Show filters")).toBeTruthy();
    expect(screen.queryByText("You are owed")).toBeNull();
    expect(screen.queryByText("You owe")).toBeNull();
  });

  it("shows split balances when the balance feature flag is missing and falls back to on", () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      ownerProfileImageUri: "",
      defaultCurrency: "EUR",
      customCurrencies: [],
    } as any;

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open Splits"));
    expect(screen.getByLabelText("Show filters")).toBeTruthy();
    expect(screen.getByText("You are owed")).toBeTruthy();
    expect(screen.getByText("You owe")).toBeTruthy();
  });

  it("renders zero settlement progress when nobody owes anything", async () => {
    const store = require("./store");
    store.getSettlementPreview.mockReturnValueOnce({
      ok: true,
      data: {
        currency: "EUR",
        totalCents: 900,
        itemBreakdown: [],
        people: [
          { participantId: "ana", name: "Ana", isPayer: true, paidCents: 900, consumedCents: 900, netCents: 0 },
        ],
        transfers: [],
      },
    });

    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(mockStoreState.markCompleted).toHaveBeenCalled();
    });

    expect(screen.getByText("Total settled")).toBeTruthy();
    expect(screen.getAllByText(/0,00|0.00/).length).toBeGreaterThan(0);
  });

  it("routes the results close header action to home", async () => {
    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(mockStoreState.markCompleted).toHaveBeenCalled();
    });
    fireEvent.press(screen.getByLabelText("Close"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("routes the results back action to review overview", async () => {
    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(mockStoreState.markCompleted).toHaveBeenCalled();
    });
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockReplace).toHaveBeenCalledWith("/split/draft-1/overview");
  });

  it("renders results fallback subtitle and skips clipboard writes when PDF data is unavailable", () => {
    const store = require("./store");
    store.getPdfExportPreview.mockReturnValueOnce(null);
    mockStoreState.records = [
      buildRecord({
        values: {
          ...buildRecord().values,
          items: [],
        },
      }),
    ];

    render(<ResultsScreen draftId="draft-1" />);
    fireEvent.press(screen.getByText("Export as PDF"));
    expect(mockSetStringAsync).not.toHaveBeenCalled();
  });
});


