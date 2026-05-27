export function buildRecordFixture(overrides: Partial<any> = {}) {
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
    reminderState: {
      participantDebtReminders: {},
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

export function createRouterMocks() {
  return {
    mockPush: jest.fn(),
    mockBack: jest.fn(),
    mockReplace: jest.fn(),
  };
}

export function buildStoreFixture(overrides: Partial<any> = {}) {
  return {
    ready: true,
    records: [buildRecordFixture()],
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
    createDraft: jest.fn(async () => buildRecordFixture({ id: "draft-2" })),
    openRecord: jest.fn(async () => buildRecordFixture()),
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
    setSplitReminder: jest.fn(async () => undefined),
    clearSplitReminder: jest.fn(async () => undefined),
    setParticipantDebtReminder: jest.fn(async () => undefined),
    clearParticipantDebtReminder: jest.fn(async () => undefined),
    markCompleted: jest.fn(async () => undefined),
    getActiveRecord: jest.fn(() => buildRecordFixture()),
    ...overrides,
  };
}

export function applyDefaultStorePreviews(store: any) {
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
}
