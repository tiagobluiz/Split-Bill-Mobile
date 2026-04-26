import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Keyboard, Share, StyleSheet, TextInput } from "react-native";
import * as domain from "../../domain";
import * as pdfExportModule from "../../pdf/exportSettlementPdf";

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
  useFocusEffect: jest.fn(),
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
    record ? "Split Bill - Groceries\nAna: paid EUR 9.00 and should get back EUR 6.00." : null
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
      splitListAmountDisplay: "remaining",
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
      record ? "Split Bill - Groceries\nAna: paid EUR 9.00 and should get back EUR 6.00." : null
    );
    store.getPdfExportPreview.mockImplementation((record: any) => (record ? { fileName: "split-bill-2026-03-09.pdf" } : null));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders review loading, pending state, and invalid finalization hints", () => {
    mockStoreState.records = [];
    const { rerender } = render(<ReviewScreen draftId="draft-1" />);
    expect(screen.getByText("Loading split")).toBeTruthy();

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
    expect(screen.getByText("Loading split")).toBeTruthy();

    mockStoreState.records = [buildRecord({ values: { ...buildRecord().values, participants: [] } })];
    rerender(<OverviewScreen draftId="draft-1" />);
    expect(screen.getByText("Not there yet...")).toBeTruthy();
    fireEvent.press(screen.getByText("Finalize Bill"));
    expect(screen.getByLabelText("Dismiss split notice")).toBeTruthy();
    expect(screen.getAllByText("Add at least two participants, including the payer.").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText("Dismiss split notice"));
    expect(screen.queryByLabelText("Dismiss split notice")).toBeNull();
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
    expect(screen.getByText("Loading split")).toBeTruthy();

    const store = require("./store");
    store.getSettlementPreview.mockReturnValueOnce(null);
    store.getClipboardSummaryPreview.mockReturnValueOnce(null);
    mockStoreState.records = [buildRecord()];
    rerender(<ResultsScreen draftId="draft-1" />);
    expect(screen.getByText("Split invalid")).toBeTruthy();
    expect(mockStoreState.markCompleted).not.toHaveBeenCalled();
  });

  it("renders results actions and completion effect", async () => {
    const exportSettlementPdfSpy = jest
      .spyOn(pdfExportModule, "exportSettlementPdf")
      .mockResolvedValue(undefined);

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
    await waitFor(() => {
      expect(exportSettlementPdfSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "EUR",
        }),
        expect.any(String),
      );
    });
    expect(screen.queryByText("Your PDF is ready to share or save.")).toBeNull();
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
    expect(screen.getByText("Under development")).toBeTruthy();
    expect(
      screen.getByText(
        "We do not save any data onto the cloud. Whatever you create on this app stays on this device. Without backup, losing the phone means losing the data too."
      )
    ).toBeTruthy();

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

  it("enforces balance and track-payments toggle dependencies in settings", async () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: false,
      trackPaymentsFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Settings"));

    fireEvent.press(screen.getByLabelText("Toggle balance helper"));
    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });
    expect(mockStoreState.updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        balanceFeatureEnabled: true,
        trackPaymentsFeatureEnabled: true,
      })
    );

    fireEvent.press(screen.getByLabelText("Toggle track payments"));
    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });
    expect(mockStoreState.updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        balanceFeatureEnabled: false,
        trackPaymentsFeatureEnabled: false,
      })
    );
  });

  it("disables balance helper immediately when track payments is turned off", async () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      trackPaymentsFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Settings"));
    fireEvent.press(screen.getByLabelText("Toggle track payments"));

    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });

    expect(mockStoreState.updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        balanceFeatureEnabled: false,
        trackPaymentsFeatureEnabled: false,
      })
    );
  });

  it("can enable track payments without enabling balance helper", async () => {
    mockStoreState.settings = {
      ownerName: "Ana",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: false,
      trackPaymentsFeatureEnabled: false,
      defaultCurrency: "EUR",
      customCurrencies: [],
    };

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Settings"));
    fireEvent.press(screen.getByLabelText("Toggle track payments"));

    await act(async () => {
      fireEvent.press(screen.getByText("Save Settings"));
    });

    expect(mockStoreState.updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        balanceFeatureEnabled: false,
        trackPaymentsFeatureEnabled: true,
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

  it("renders results fallback subtitle and skips export when PDF data is unavailable", () => {
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
    fireEvent.press(screen.getByLabelText("Export as PDF"));
    expect(screen.getByText("Almost there")).toBeTruthy();
    expect(screen.getByText("PDF export is not available for this split.")).toBeTruthy();
  });

  it("shows export failure feedback when generating the PDF fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest
      .spyOn(pdfExportModule, "exportSettlementPdf")
      .mockRejectedValueOnce(new Error("pdf down"));

    render(<ResultsScreen draftId="draft-1" />);
    fireEvent.press(screen.getByLabelText("Export as PDF"));

    await waitFor(() => {
      expect(screen.getByText("Almost there")).toBeTruthy();
      expect(screen.getByText("Could not generate the PDF.")).toBeTruthy();
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("handles markCompleted failures without crashing results rendering", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockStoreState.markCompleted = jest.fn(async () => {
      throw new Error("boom");
    });

    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(screen.getByText("Final Results")).toBeTruthy();
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("shows feedback when mark bill paid update fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockStoreState.markBillPaid = jest.fn(async () => {
      throw new Error("write failed");
    });

    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(mockStoreState.markCompleted).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByText("Mark as Paid"));
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Update failed", "Could not update the bill payment status.", undefined);
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("shows feedback when participant paid toggle update fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockStoreState.toggleParticipantPaid = jest.fn(async () => {
      throw new Error("toggle failed");
    });

    render(<ResultsScreen draftId="draft-1" />);
    await waitFor(() => {
      expect(mockStoreState.markCompleted).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByLabelText("Mark Bruno as paid"));
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Update failed", "Could not update Bruno's payment status.", undefined);
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

