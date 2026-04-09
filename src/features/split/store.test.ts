type LoadedStore = {
  storeModule: typeof import("./store");
  storageMocks: {
    initializeRecordsStorage: jest.Mock;
    listRecords: jest.Mock;
    getRecordById: jest.Mock;
    saveRecord: jest.Mock;
    deleteRecord: jest.Mock;
    initializeSettingsStorage: jest.Mock;
    getAppSettings: jest.Mock;
    saveAppSettings: jest.Mock;
  };
  domainMocks: {
    buildClipboardSummary: jest.Mock;
    buildPdfExportData: jest.Mock;
    computeSettlement: jest.Mock;
    createId: jest.Mock;
    parsePastedItems: jest.Mock;
    rebalancePercentAllocations: jest.Mock;
  };
};

function createValues() {
  return {
    splitName: "",
    currency: "EUR",
    payerParticipantId: "ana",
    participants: [
      { id: "ana", name: "Ana" },
      { id: "bruno", name: "Bruno" },
    ],
    items: [
      {
        id: "item-even",
        name: "Milk",
        price: "3.50",
        splitMode: "even" as const,
        allocations: [
          { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
          { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
        ],
      },
      {
        id: "item-shares",
        name: "Bread",
        price: "2.50",
        splitMode: "shares" as const,
        allocations: [
          { participantId: "ana", evenIncluded: true, shares: "2", percent: "50", percentLocked: false },
          { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
        ],
      },
      {
        id: "item-percent",
        name: "Juice",
        price: "4.00",
        splitMode: "percent" as const,
        allocations: [
          { participantId: "ana", evenIncluded: true, shares: "1", percent: "60", percentLocked: false },
          { participantId: "bruno", evenIncluded: true, shares: "1", percent: "40", percentLocked: false },
        ],
      },
    ],
  };
}

function createRecord(overrides: Partial<any> = {}) {
  return {
    id: "draft-1",
    status: "draft" as const,
    step: 1,
    values: createValues(),
    settlementState: {
      settledParticipantIds: [],
    },
    createdAt: "2026-04-04T10:00:00.000Z",
    updatedAt: "2026-04-04T10:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

async function loadStore(options?: {
  listRecords?: any[];
  recordById?: any | null;
  parseResult?: { items: Array<{ name: string; price: string }>; warnings: Array<{ code: string; message: string }> };
  rebalanceResult?: any[] | null;
}): Promise<LoadedStore> {
  jest.resetModules();

  const storageMocks = {
    initializeRecordsStorage: jest.fn(async () => undefined),
    listRecords: jest.fn(async () => options?.listRecords ?? []),
    getRecordById: jest.fn(async (id: string) =>
      options?.recordById && options.recordById.id === id ? options.recordById : null
    ),
    saveRecord: jest.fn(async () => undefined),
    deleteRecord: jest.fn(async () => undefined),
    initializeSettingsStorage: jest.fn(async () => undefined),
    getAppSettings: jest.fn(async () => ({
      ownerName: "You",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    })),
    saveAppSettings: jest.fn(async () => undefined),
  };

  const actualDomain = jest.requireActual("../../domain");
  let idCounter = 0;

  const domainMocks = {
    buildClipboardSummary: jest.fn(() => "summary output"),
    buildPdfExportData: jest.fn(() => ({ fileName: "split-bill-2026-04-04.pdf" })),
    computeSettlement: jest.fn(() => ({
      ok: true,
      data: {
        currency: "EUR",
        totalCents: 1000,
        itemBreakdown: [],
        people: [
          { participantId: "ana", name: "Ana", isPayer: true, paidCents: 1000, consumedCents: 500, netCents: 500 },
          { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: 500, netCents: -500 },
        ],
        transfers: [],
      },
    })),
    createId: jest.fn(() => `generated-${++idCounter}`),
    parsePastedItems: jest.fn(
      () =>
        options?.parseResult ?? {
          items: [
            { name: "Imported apples", price: "1.25" },
            { name: "Imported pears", price: "2.75" },
          ],
          warnings: [{ code: "ignored-paste-lines", message: "Ignored 1 pasted line." }],
        }
    ),
    rebalancePercentAllocations: jest.fn((allocations: any[], participantId: string, nextValue: string) => {
      if (typeof options?.rebalanceResult !== "undefined") {
        return options.rebalanceResult;
      }
      return actualDomain.rebalancePercentAllocations(allocations, participantId, nextValue);
    }),
  };

  jest.doMock("../../storage/records", () => storageMocks);
  jest.doMock("../../storage/settings", () => ({
    initializeSettingsStorage: storageMocks.initializeSettingsStorage,
    getAppSettings: storageMocks.getAppSettings,
    saveAppSettings: storageMocks.saveAppSettings,
  }));
  const actualDevice = jest.requireActual("../../lib/device");
  jest.doMock("../../lib/device", () => ({
    ...actualDevice,
    getDeviceLocale: () => "en-US",
  }));
  jest.doMock("../../domain", () => ({
    ...actualDomain,
    ...domainMocks,
  }));

  let storeModule: typeof import("./store");
  jest.isolateModules(() => {
    storeModule = require("./store");
  });

  return {
    storeModule: storeModule!,
    storageMocks,
    domainMocks,
  };
}

async function loadReadyStore(options?: {
  record?: any;
  listRecords?: any[];
  recordById?: any | null;
  parseResult?: { items: Array<{ name: string; price: string }>; warnings: Array<{ code: string; message: string }> };
  rebalanceResult?: any[] | null;
}) {
  const record = options?.record ?? createRecord();
  const loaded = await loadStore({
    listRecords: options?.listRecords ?? [record],
    recordById: options?.recordById,
    parseResult: options?.parseResult,
    rebalanceResult: options?.rebalanceResult,
  });

  loaded.storeModule.useSplitStore.setState({
    ready: true,
    records: options?.listRecords ?? [record],
    activeRecordId: record.id,
  });

  return {
    ...loaded,
    record,
  };
}

describe("split store", () => {
  it("bootstraps, creates drafts, opens records, and removes records", async () => {
    const existing = createRecord({ id: "draft-existing", status: "completed" as const, step: 5 });
    const fetched = createRecord({ id: "draft-fetched" });
    const { storeModule, storageMocks } = await loadStore({
      listRecords: [existing],
      recordById: fetched,
    });

    await storeModule.useSplitStore.getState().bootstrap();
    expect(storageMocks.initializeSettingsStorage).toHaveBeenCalledTimes(1);
    expect(storageMocks.initializeRecordsStorage).toHaveBeenCalledTimes(1);
    expect(storeModule.useSplitStore.getState().ready).toBe(true);
    expect(storeModule.useSplitStore.getState().activeRecordId).toBe("draft-existing");

    const created = await storeModule.useSplitStore.getState().createDraft();
    expect(created.id).toBe("generated-1");
    expect(storageMocks.saveRecord).toHaveBeenCalledWith(expect.objectContaining({ id: "generated-1" }));

    const openedExisting = await storeModule.useSplitStore.getState().openRecord("draft-existing");
    expect(openedExisting?.id).toBe("draft-existing");
    expect(storageMocks.getRecordById).not.toHaveBeenCalled();

    const openedFetched = await storeModule.useSplitStore.getState().openRecord("draft-fetched");
    expect(openedFetched?.id).toBe("draft-fetched");

    await expect(storeModule.useSplitStore.getState().openRecord("missing")).resolves.toBeNull();

    await storeModule.useSplitStore.getState().removeRecord("draft-existing");
    expect(storageMocks.deleteRecord).toHaveBeenCalledWith("draft-existing");
  });

  it("updates persisted settings", async () => {
    const { storeModule, storageMocks } = await loadStore();
    await storeModule.useSplitStore.getState().bootstrap();
    await storeModule.useSplitStore.getState().updateSettings({
      ownerName: "Tiago",
      balanceFeatureEnabled: false,
    });
    expect(storeModule.useSplitStore.getState().settings).toEqual({
      ownerName: "Tiago",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: false,
      defaultCurrency: "EUR",
      customCurrencies: [],
    });
    expect(storageMocks.saveAppSettings).toHaveBeenCalledWith({
      ownerName: "Tiago",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: false,
      defaultCurrency: "EUR",
      customCurrencies: [],
    });
  });

  it("renames owner references in stored records when the profile name changes", async () => {
    const record = createRecord({
      values: {
        ...createValues(),
        participants: [
          { id: "owner", name: "You" },
          { id: "bruno", name: "Bruno" },
        ],
        payerParticipantId: "owner",
      },
    });
    const { storeModule, storageMocks } = await loadStore({
      listRecords: [record],
    });

    await storeModule.useSplitStore.getState().bootstrap();
    await storeModule.useSplitStore.getState().updateSettings({
      ownerName: "Tiago Luiz",
    });

    expect(storeModule.useSplitStore.getState().records[0]?.values.participants).toEqual([
      { id: "owner", name: "Tiago Luiz" },
      { id: "bruno", name: "Bruno" },
    ]);
    expect(storageMocks.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          participants: [
            { id: "owner", name: "Tiago Luiz" },
            { id: "bruno", name: "Bruno" },
          ],
        }),
      })
    );
  });

  it("keeps records untouched when the next owner name is blank or the participant name is blank", async () => {
    const record = createRecord({
      values: {
        ...createValues(),
        participants: [
          { id: "owner", name: "" },
          { id: "bruno", name: "Bruno" },
        ],
      },
    });
    const { storeModule, storageMocks } = await loadStore({
      listRecords: [record],
    });

    await storeModule.useSplitStore.getState().bootstrap();
    await storeModule.useSplitStore.getState().updateSettings({
      ownerName: "   ",
    });

    expect(storeModule.useSplitStore.getState().records[0]).toEqual(record);
    expect(storageMocks.saveRecord).toHaveBeenCalledWith(record);
  });

  it("ignores blank participant names while still renaming owner aliases", async () => {
    const record = createRecord({
      values: {
        ...createValues(),
        participants: [
          { id: "empty", name: "" },
          { id: "owner", name: "You" },
        ],
        payerParticipantId: "owner",
      },
    });
    const { storeModule } = await loadStore({
      listRecords: [record],
    });

    await storeModule.useSplitStore.getState().bootstrap();
    await storeModule.useSplitStore.getState().updateSettings({
      ownerName: "Tiago Luiz",
    });

    expect(storeModule.useSplitStore.getState().records[0]?.values.participants).toEqual([
      { id: "empty", name: "" },
      { id: "owner", name: "Tiago Luiz" },
    ]);
  });

  it("does not rewrite records when the owner name stays the same", async () => {
    const record = createRecord();
    const { storeModule, storageMocks } = await loadStore({
      listRecords: [record],
    });

    await storeModule.useSplitStore.getState().bootstrap();
    await storeModule.useSplitStore.getState().updateSettings({
      ownerName: "You",
      balanceFeatureEnabled: false,
    });

    expect(storeModule.useSplitStore.getState().records[0]).toEqual(record);
    expect(storageMocks.saveRecord).toHaveBeenCalledWith(record);
  });

  it("handles missing owner settings and rename passes with no owner aliases in records", async () => {
    const record = createRecord({
      values: {
        ...createValues(),
        participants: [
          { id: "ana", name: "Ana" },
          { id: "bruno", name: "Bruno" },
        ],
      },
    });
    const { storeModule, storageMocks } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
      settings: {
        ownerName: undefined,
        ownerProfileImageUri: "",
        balanceFeatureEnabled: true,
        defaultCurrency: "EUR",
        customCurrencies: [],
      } as any,
    });

    await storeModule.useSplitStore.getState().updateSettings({
      balanceFeatureEnabled: false,
    });
    expect(storeModule.useSplitStore.getState().records[0]).toEqual(record);

    await storeModule.useSplitStore.getState().updateSettings({
      ownerName: "Tiago Luiz",
    });
    expect(storeModule.useSplitStore.getState().records[0]?.values.participants).toEqual([
      { id: "ana", name: "Ana" },
      { id: "bruno", name: "Bruno" },
    ]);
    expect(storageMocks.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          participants: [
            { id: "ana", name: "Ana" },
            { id: "bruno", name: "Bruno" },
          ],
        }),
      })
    );
  });

  it("updates split metadata and falls back to the default currency when blank", async () => {
    const record = createRecord();
    const { storeModule } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
      settings: { ownerName: "You", ownerProfileImageUri: "", balanceFeatureEnabled: true, defaultCurrency: "GBP", customCurrencies: [] },
    });

    await storeModule.useSplitStore.getState().updateDraftMeta("Trip", "usd");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.splitName).toBe("Trip");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.currency).toBe("USD");

    await storeModule.useSplitStore.getState().updateDraftMeta("Trip", "   ");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.currency).toBe("GBP");
  });

  it("builds clipboard preview from the current settlement state", async () => {
    const record = createRecord({
      settlementState: {
        settledParticipantIds: ["bruno"],
      },
    });
    const { storeModule, domainMocks } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
    });

    expect(storeModule.getClipboardSummaryPreview(record)).toBe("summary output");
    expect(domainMocks.buildClipboardSummary).toHaveBeenCalledWith(record.values, "en-US", {
      settledParticipantIds: ["bruno"],
    });
  });

  it("builds clipboard preview with an empty settled list when settlement state is missing", async () => {
    const record = createRecord({
      settlementState: undefined,
    });
    const { storeModule, domainMocks } = await loadStore({
      listRecords: [record],
    });

    expect(storeModule.getClipboardSummaryPreview(record)).toBe("summary output");
    expect(domainMocks.buildClipboardSummary).toHaveBeenCalledWith(record.values, "en-US", {
      settledParticipantIds: [],
    });
  });

  it("bootstraps with no records and preserves the active record when deleting another entry", async () => {
    const record = createRecord({ id: "draft-active" });
    const other = createRecord({ id: "draft-other" });
    const { storeModule } = await loadStore({
      listRecords: [],
    });

    await storeModule.useSplitStore.getState().bootstrap();
    expect(storeModule.useSplitStore.getState().activeRecordId).toBeNull();

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record, other],
      activeRecordId: "draft-active",
    });

    await storeModule.useSplitStore.getState().removeRecord("draft-other");
    expect(storeModule.useSplitStore.getState().activeRecordId).toBe("draft-active");
  });

  it("reassigns the active record when the current one is removed and another record remains", async () => {
    const first = createRecord({ id: "draft-first", updatedAt: "2026-04-04T10:00:00.000Z" });
    const second = createRecord({ id: "draft-second", updatedAt: "2026-04-04T09:00:00.000Z" });
    const { storeModule } = await loadStore({
      listRecords: [first, second],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [first, second],
      activeRecordId: "draft-first",
    });

    await storeModule.useSplitStore.getState().removeRecord("draft-first");
    expect(storeModule.useSplitStore.getState().activeRecordId).toBe("draft-second");
  });

  it("clears the active record when the last remaining record is removed", async () => {
    const only = createRecord({ id: "draft-only" });
    const { storeModule } = await loadStore({
      listRecords: [only],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [only],
      activeRecordId: "draft-only",
    });

    await storeModule.useSplitStore.getState().removeRecord("draft-only");
    expect(storeModule.useSplitStore.getState().activeRecordId).toBeNull();
  });

  it("updates steps and participant ownership fields on the active record", async () => {
    const { storeModule } = await loadReadyStore();
    await storeModule.useSplitStore.getState().setStep(2);
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.step).toBe(2);

    await storeModule.useSplitStore.getState().updateParticipants([{ id: "solo", name: "Solo" }]);
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.participants).toEqual([{ id: "solo", name: "Solo" }]);
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.payerParticipantId).toBe("");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.step).toBe(2);

    await storeModule.useSplitStore.getState().setPayer("solo");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.payerParticipantId).toBe("solo");
  });

  it("creates, updates, and removes items on the active record", async () => {
    const { storeModule, storageMocks } = await loadReadyStore();
    await storeModule.useSplitStore.getState().createItem({
      id: "item-created",
      name: "Created here",
      price: "1.00",
      category: "",
      splitMode: "even",
      allocations: [
        { participantId: "solo", evenIncluded: true, shares: "1", percent: "100", percentLocked: false },
      ],
    });
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items.some((item) => item.id === "item-created")).toBe(true);

    await storeModule.useSplitStore.getState().saveItemSplit("item-even", {
      ...storeModule.useSplitStore.getState().getActiveRecord()!.values.items[0],
      splitMode: "shares",
      allocations: [
        { participantId: "ana", evenIncluded: true, shares: "3", percent: "75", percentLocked: false },
        { participantId: "bruno", evenIncluded: true, shares: "1", percent: "25", percentLocked: false },
      ],
    });
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items[0]).toEqual(
      expect.objectContaining({
        id: "item-even",
        splitMode: "shares",
        allocations: expect.arrayContaining([
          expect.objectContaining({ participantId: "ana", shares: "3" }),
          expect.objectContaining({ participantId: "bruno", shares: "1" }),
        ]),
      })
    );

    await storeModule.useSplitStore.getState().updateItemField("item-even", "name", "Updated milk");
    await storeModule.useSplitStore.getState().updateItemField("item-even", "price", "9.99");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items[0]).toEqual(
      expect.objectContaining({ name: "Updated milk", price: "9.99" })
    );

    await storeModule.useSplitStore.getState().removeItem("item-even");
    expect(
      storeModule.useSplitStore.getState().getActiveRecord()?.values.items.some((item) => item.id === "item-even")
    ).toBe(false);
    expect(storageMocks.saveRecord).toHaveBeenCalled();
  });

  it("updates split allocations across even, shares, and percent modes", async () => {
    const { storeModule, record, domainMocks } = await loadReadyStore();
    await storeModule.useSplitStore.getState().toggleEvenIncluded("item-even", "ana");
    expect(
      storeModule.useSplitStore.getState().getActiveRecord()?.values.items[0].allocations[0]?.evenIncluded
    ).toBe(false);

    await storeModule.useSplitStore.getState().setItemSplitMode("item-even", "percent");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items[0]?.splitMode).toBe("percent");
    await storeModule.useSplitStore.getState().setItemSplitMode("item-even", "shares");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items[0]?.splitMode).toBe("shares");
    await storeModule.useSplitStore.getState().setItemSplitMode("item-even", "even");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items[0]?.splitMode).toBe("even");

    await storeModule.useSplitStore.getState().setItemSharesValue("item-shares", "ana", "7");
    expect(
      storeModule.useSplitStore.getState().getActiveRecord()?.values.items[1].allocations[0]?.shares
    ).toBe("7");

    const didChangePercent = await storeModule.useSplitStore.getState().setItemPercentValue("item-percent", "ana", "100");
    expect(didChangePercent).toBe(true);
    expect(domainMocks.rebalancePercentAllocations).toHaveBeenCalled();

    const storeWithRejectedPercent = await loadReadyStore({
      record,
      rebalanceResult: null,
    });
    await expect(
      storeWithRejectedPercent.storeModule.useSplitStore.getState().setItemPercentValue("item-percent", "ana", "70")
    ).resolves.toBe(false);

    await storeModule.useSplitStore.getState().resetItemAllocations("item-percent");
    await storeModule.useSplitStore.getState().resetItemAllocations("item-shares");
    await storeModule.useSplitStore.getState().resetItemAllocations("item-even");

    await storeModule.useSplitStore.getState().focusOnlyParticipant("item-even", "ana");
    expect(
      storeModule.useSplitStore.getState().getActiveRecord()?.values.items[0]?.allocations.map((allocation) => allocation.evenIncluded)
    ).toEqual([true, false]);

    await storeModule.useSplitStore.getState().focusOnlyParticipant("item-shares", "ana");
    expect(
      storeModule.useSplitStore.getState().getActiveRecord()?.values.items[1]?.allocations.map((allocation) => allocation.shares)
    ).toEqual(["1", "0"]);

    await storeModule.useSplitStore.getState().focusOnlyParticipant("item-percent", "ana");
    expect(
      storeModule.useSplitStore.getState().getActiveRecord()?.values.items[2]?.allocations.map((allocation) => allocation.percent)
    ).toEqual(["100", "0"]);
  });

  it("imports pasted items into the active record", async () => {
    const { storeModule, domainMocks } = await loadReadyStore();
    await storeModule.useSplitStore.getState().importPastedList("ignored text", "append");
    expect(domainMocks.parsePastedItems).toHaveBeenCalledWith("ignored text");
    expect(
      storeModule.useSplitStore.getState().getActiveRecord()?.values.items.some((item) => item.name === "Imported apples")
    ).toBe(true);

    await storeModule.useSplitStore.getState().importPastedList("replace text", "replace");
    expect(
      storeModule.useSplitStore.getState().getActiveRecord()?.values.items.map((item) => item.name)
    ).toEqual(["Imported apples", "Imported pears"]);
  });

  it("marks the active record as completed", async () => {
    const { storeModule, storageMocks } = await loadReadyStore();
    await storeModule.useSplitStore.getState().markCompleted();
    expect(storeModule.useSplitStore.getState().getActiveRecord()).toEqual(
      expect.objectContaining({ status: "completed", step: 6 })
    );
    expect(storageMocks.saveRecord).toHaveBeenCalled();
  });

  it("marks and reverts paid settlement state for the active record", async () => {
    const record = createRecord();
    const { storeModule } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
      settings: { ownerName: "You", ownerProfileImageUri: "", balanceFeatureEnabled: true, defaultCurrency: "EUR", customCurrencies: [] },
    });

    await storeModule.useSplitStore.getState().toggleParticipantPaid("bruno");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.settlementState.settledParticipantIds).toEqual(["bruno"]);

    await storeModule.useSplitStore.getState().toggleParticipantPaid("bruno");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.settlementState.settledParticipantIds).toEqual([]);

    await storeModule.useSplitStore.getState().markBillPaid();
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.settlementState.settledParticipantIds).toEqual(["bruno"]);

    await storeModule.useSplitStore.getState().revertBillPaid();
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.settlementState.settledParticipantIds).toEqual([]);
  });

  it("tracks paid settlement state for reverse settlements where the payer owes others", async () => {
    const record = createRecord();
    const { storeModule, domainMocks } = await loadStore({
      listRecords: [record],
    });

    domainMocks.computeSettlement.mockReturnValue({
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

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
      settings: { ownerName: "You", ownerProfileImageUri: "", balanceFeatureEnabled: true, defaultCurrency: "EUR", customCurrencies: [] },
    });

    await storeModule.useSplitStore.getState().markBillPaid();
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.settlementState.settledParticipantIds.sort()).toEqual([
      "bruno",
      "zoe",
    ]);

    await storeModule.useSplitStore.getState().toggleParticipantPaid("zoe");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.settlementState.settledParticipantIds).toEqual(["bruno"]);
  });

  it("ignores paid toggles for non-debtors and clears settled ids when participants are removed", async () => {
    const record = createRecord({
      settlementState: {
        settledParticipantIds: ["bruno"],
      },
    });
    const { storeModule } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
      settings: { ownerName: "You", ownerProfileImageUri: "", balanceFeatureEnabled: true, defaultCurrency: "EUR", customCurrencies: [] },
    });

    await storeModule.useSplitStore.getState().toggleParticipantPaid("ana");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.settlementState.settledParticipantIds).toEqual(["bruno"]);

    await storeModule.useSplitStore.getState().updateParticipants([{ id: "ana", name: "Ana" }]);
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.settlementState.settledParticipantIds).toEqual([]);
  });

  it("keeps bill-paid settlement empty when the current draft cannot be settled", async () => {
    const record = createRecord();
    const { storeModule, domainMocks } = await loadStore({
      listRecords: [record],
    });

    domainMocks.computeSettlement.mockReturnValueOnce({
      ok: false,
      errors: [],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
      settings: { ownerName: "You", ownerProfileImageUri: "", balanceFeatureEnabled: true, defaultCurrency: "EUR", customCurrencies: [] },
    });

    await storeModule.useSplitStore.getState().markBillPaid();
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.settlementState.settledParticipantIds).toEqual([]);
  });

  it("keeps bill-paid settlement empty when the payer has no net balance", async () => {
    const record = createRecord();
    const { storeModule, domainMocks } = await loadStore({
      listRecords: [record],
    });

    domainMocks.computeSettlement.mockReturnValue({
      ok: true,
      data: {
        currency: "EUR",
        totalCents: 0,
        itemBreakdown: [],
        people: [
          { participantId: "ana", name: "Ana", isPayer: true, paidCents: 0, consumedCents: 0, netCents: 0 },
          { participantId: "bruno", name: "Bruno", isPayer: false, paidCents: 0, consumedCents: 0, netCents: 0 },
        ],
        transfers: [],
      },
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
      settings: { ownerName: "You", ownerProfileImageUri: "", balanceFeatureEnabled: true, defaultCurrency: "EUR", customCurrencies: [] },
    });

    await storeModule.useSplitStore.getState().markBillPaid();
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.settlementState.settledParticipantIds).toEqual([]);
  });

  it("keeps the payer when updated participants still contain that participant and ignores unmatched allocation edits", async () => {
    const record = createRecord();
    const { storeModule } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
    });

    await storeModule.useSplitStore.getState().updateParticipants([
      { id: "ana", name: "Ana" },
      { id: "bruno", name: "Bruno" },
      { id: "carla", name: "Carla" },
    ]);
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.payerParticipantId).toBe("ana");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.step).toBe(1);

    const beforeToggle = storeModule.useSplitStore.getState().getActiveRecord()?.values.items[0].allocations.map((entry) => entry.evenIncluded);
    await storeModule.useSplitStore.getState().toggleEvenIncluded("item-even", "missing");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items[0].allocations.map((entry) => entry.evenIncluded)).toEqual(beforeToggle);

    const beforeShares = storeModule.useSplitStore.getState().getActiveRecord()?.values.items[1].allocations.map((entry) => entry.shares);
    await storeModule.useSplitStore.getState().setItemSharesValue("item-shares", "missing", "9");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items[1].allocations.map((entry) => entry.shares)).toEqual(beforeShares);
  });

  it("falls back to payer when participants stay valid but the payer is cleared", async () => {
    const record = createRecord({ step: 4 });
    const { storeModule } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
    });

    await storeModule.useSplitStore.getState().updateParticipants([
      { id: "ana-2", name: "Ana" },
      { id: "bruno-2", name: "Bruno" },
    ]);

    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.payerParticipantId).toBe("");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.step).toBe(3);
  });

  it("keeps the draft on participants until the user explicitly advances, even when participant data is already valid", async () => {
    const record = createRecord({
      step: 1,
      values: {
        ...createRecord().values,
        participants: [
          { id: "ana", name: "Ana" },
          { id: "bruno", name: "Bruno" },
        ],
        payerParticipantId: "",
        items: [],
      },
    });
    const { storeModule } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
    });

    await storeModule.useSplitStore.getState().updateParticipants([
      { id: "ana", name: "Ana" },
      { id: "bruno", name: "Bruno" },
    ]);

    expect(storeModule.useSplitStore.getState().getActiveRecord()?.step).toBe(1);

    await storeModule.useSplitStore.getState().setStep(2);
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.step).toBe(2);
  });

  it("falls back to participants when a stored draft step is non-finite", async () => {
    const record = createRecord({
      step: Number.NaN,
      values: {
        ...createValues(),
        participants: [
          { id: "ana", name: "Ana" },
          { id: "bruno", name: "Bruno" },
        ],
        payerParticipantId: "",
        items: [],
      },
    });
    const { storeModule } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
    });

    await storeModule.useSplitStore.getState().updateParticipants(record.values.participants);
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.step).toBe(1);
  });

  it("focuses percent allocations onto one participant and keeps append imports from blank existing items", async () => {
    const record = createRecord({
      values: {
        ...createValues(),
        items: [
          ...createValues().items,
          {
            id: "blank",
            name: "",
            price: "",
            splitMode: "even" as const,
            allocations: [
              { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
              { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
            ],
          },
        ],
      },
    });
    const { storeModule } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
    });

    await storeModule.useSplitStore.getState().focusOnlyParticipant("item-percent", "ana");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items[2].allocations).toEqual([
      expect.objectContaining({ participantId: "ana", percent: "100", percentLocked: true }),
      expect.objectContaining({ participantId: "bruno", percent: "0", percentLocked: false }),
    ]);

    await storeModule.useSplitStore.getState().importPastedList("ignored text", "append");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items.some((item) => item.id === "blank")).toBe(false);
  });

  it("focuses share allocations onto one participant while zeroing the rest", async () => {
    const record = createRecord();
    const { storeModule } = await loadStore({
      listRecords: [record],
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
    });

    await storeModule.useSplitStore.getState().focusOnlyParticipant("item-shares", "ana");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items[1].allocations).toEqual([
      expect.objectContaining({ participantId: "ana", shares: "1" }),
      expect.objectContaining({ participantId: "bruno", shares: "0" }),
    ]);
  });

  it("returns null safely when preview helpers receive no record", async () => {
    const { storeModule } = await loadStore();

    expect(storeModule.getSettlementPreview(null)).toBeNull();
    expect(storeModule.getClipboardSummaryPreview(null)).toBeNull();
    expect(storeModule.getPdfExportPreview(null)).toBeNull();
  });

  it("ignores active-record mutations when no record is selected", async () => {
    const { storeModule, storageMocks } = await loadStore();

    storeModule.useSplitStore.setState({
      ready: true,
      records: [],
      activeRecordId: null,
    });

    await storeModule.useSplitStore.getState().setStep(2);
    expect(storageMocks.saveRecord).not.toHaveBeenCalled();
  });

  it("builds previews for a real record", async () => {
    const record = createRecord();
    const { storeModule, domainMocks } = await loadStore();

    expect(storeModule.getSettlementPreview(record)).toEqual(
      expect.objectContaining({
        ok: true,
      })
    );
    expect(storeModule.getClipboardSummaryPreview(record)).toBe("summary output");
    expect(storeModule.getPdfExportPreview(record)).toEqual({ fileName: "split-bill-2026-04-04.pdf" });
    expect(domainMocks.buildClipboardSummary).toHaveBeenCalled();
    expect(domainMocks.buildPdfExportData).toHaveBeenCalled();
  });

  it("keeps existing items when a replace import parses zero rows", async () => {
    const record = createRecord();
    const { storeModule } = await loadStore({
      listRecords: [record],
      parseResult: {
        items: [],
        warnings: [{ code: "no-items-detected", message: "No items." }],
      },
    });

    storeModule.useSplitStore.setState({
      ready: true,
      records: [record],
      activeRecordId: record.id,
    });

    await storeModule.useSplitStore.getState().importPastedList("totals only", "replace");
    expect(storeModule.useSplitStore.getState().getActiveRecord()?.values.items).toEqual(record.values.items);
  });
});
