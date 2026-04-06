describe("records storage", () => {
  async function loadModule(options?: {
    rows?: any[];
    row?: any | null;
  }) {
    jest.resetModules();

    const database = {
      execAsync: jest.fn(async () => undefined),
      getAllAsync: jest.fn(async () => options?.rows ?? []),
      getFirstAsync: jest.fn(async () => options?.row ?? null),
      runAsync: jest.fn(async () => undefined),
    };

    const openDatabaseAsync = jest.fn(async () => database);

    jest.doMock("expo-sqlite", () => ({
      openDatabaseAsync,
    }));

    let recordsModule: typeof import("./records");
    jest.isolateModules(() => {
      recordsModule = require("./records");
    });

    return {
      database,
      openDatabaseAsync,
      recordsModule: recordsModule!,
    };
  }

  it("initializes, lists, loads, saves, and deletes records through one cached database connection", async () => {
    const row = {
      id: "draft-1",
      status: "completed",
      step: 5,
      payload: JSON.stringify({
        splitName: "",
        currency: "EUR",
        payerParticipantId: "ana",
        participants: [{ id: "ana", name: "Ana" }],
        items: [],
      }),
      created_at: "2026-04-04T09:00:00.000Z",
      updated_at: "2026-04-04T10:00:00.000Z",
      completed_at: "2026-04-04T10:00:00.000Z",
    };

    const { database, openDatabaseAsync, recordsModule } = await loadModule({
      rows: [row],
      row,
    });

    await recordsModule.initializeRecordsStorage();
    const listed = await recordsModule.listRecords();
    const loaded = await recordsModule.getRecordById("draft-1");

    await recordsModule.saveRecord({
      id: "draft-2",
      status: "draft",
      step: 2,
      settlementState: {
        settledParticipantIds: [],
      },
        values: {
          splitName: "",
          currency: "USD",
        payerParticipantId: "payer",
        participants: [{ id: "payer", name: "Payer" }],
        items: [],
      },
      createdAt: "2026-04-04T11:00:00.000Z",
      updatedAt: "2026-04-04T11:00:00.000Z",
      completedAt: null,
    });
    await recordsModule.deleteRecord("draft-2");

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(database.execAsync).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS split_records"));
    expect(database.getAllAsync).toHaveBeenCalledWith(
      "SELECT id, status, step, payload, created_at, updated_at, completed_at FROM split_records ORDER BY updated_at DESC"
    );
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      "SELECT id, status, step, payload, created_at, updated_at, completed_at FROM split_records WHERE id = ?",
      ["draft-1"]
    );
    expect(listed).toEqual([
      {
        id: "draft-1",
        status: "completed",
        step: 5,
        values: {
          splitName: "",
          currency: "EUR",
          payerParticipantId: "ana",
          participants: [{ id: "ana", name: "Ana" }],
          items: [],
        },
        settlementState: {
          settledParticipantIds: [],
        },
        createdAt: "2026-04-04T09:00:00.000Z",
        updatedAt: "2026-04-04T10:00:00.000Z",
        completedAt: "2026-04-04T10:00:00.000Z",
      },
    ]);
    expect(loaded).toEqual(listed[0]);
    expect(database.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("INSERT OR REPLACE INTO split_records"),
      [
        "draft-2",
        "draft",
        2,
        JSON.stringify({
          values: {
            splitName: "",
            currency: "USD",
            payerParticipantId: "payer",
            participants: [{ id: "payer", name: "Payer" }],
            items: [],
          },
          settlementState: {
            settledParticipantIds: [],
          },
        }),
        "2026-04-04T11:00:00.000Z",
        "2026-04-04T11:00:00.000Z",
        null,
      ]
    );
    expect(database.runAsync).toHaveBeenNthCalledWith(2, "DELETE FROM split_records WHERE id = ?", ["draft-2"]);
  });

  it("returns null when a requested record does not exist", async () => {
    const { recordsModule } = await loadModule({
      rows: [],
      row: null,
    });

    await recordsModule.initializeRecordsStorage();
    await expect(recordsModule.getRecordById("missing")).resolves.toBeNull();
  });

  it("defaults settlement state when saving a legacy-shaped record", async () => {
    const { database, recordsModule } = await loadModule();

    await recordsModule.initializeRecordsStorage();
    await recordsModule.saveRecord({
      id: "legacy-save",
      status: "draft",
      step: 1,
      values: {
        splitName: "",
        currency: "EUR",
        payerParticipantId: "",
        participants: [],
        items: [],
      },
      createdAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
      completedAt: null,
    } as any);

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO split_records"),
      expect.arrayContaining([
        "legacy-save",
        "draft",
        1,
        JSON.stringify({
          values: {
            splitName: "",
            currency: "EUR",
            payerParticipantId: "",
            participants: [],
            items: [],
          },
          settlementState: {
            settledParticipantIds: [],
          },
        }),
      ])
    );
  });

  it("filters legacy placeholder items when loading saved records", async () => {
    const row = {
      id: "draft-legacy",
      status: "draft",
      step: 3,
      payload: JSON.stringify({
        splitName: "",
        currency: "EUR",
        payerParticipantId: "ana",
        participants: [{ id: "ana", name: "Ana" }],
        items: [
          null,
          {
            id: "placeholder-1",
            name: "",
            price: "",
            category: "",
            splitMode: "even",
            allocations: [],
          },
          {
            id: "placeholder-2",
            name: "Item",
            price: "",
            category: "",
            splitMode: "even",
            allocations: [],
          },
          {
            id: "real-item",
            name: "Milk",
            price: "3.50",
            category: "Dairy",
            splitMode: "even",
            allocations: [],
          },
        ],
      }),
      created_at: "2026-04-04T09:00:00.000Z",
      updated_at: "2026-04-04T10:00:00.000Z",
      completed_at: null,
    };

    const { recordsModule } = await loadModule({
      rows: [row],
      row,
    });

    await recordsModule.initializeRecordsStorage();

    await expect(recordsModule.listRecords()).resolves.toEqual([
      expect.objectContaining({
        id: "draft-legacy",
        values: expect.objectContaining({
          items: [
            expect.objectContaining({
              id: "real-item",
              name: "Milk",
            }),
          ],
        }),
        settlementState: {
          settledParticipantIds: [],
        },
      }),
    ]);
    await expect(recordsModule.getRecordById("draft-legacy")).resolves.toEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          items: [
            expect.objectContaining({
              id: "real-item",
            }),
          ],
        }),
        settlementState: {
          settledParticipantIds: [],
        },
      })
    );
  });

  it("falls back to an empty items array when saved payload items are malformed", async () => {
    const row = {
      id: "draft-malformed-items",
      status: "draft",
      step: 2,
      payload: JSON.stringify({
        currency: "EUR",
        payerParticipantId: "",
        participants: [{ id: "ana", name: "Ana" }],
        items: null,
      }),
      created_at: "2026-04-04T09:00:00.000Z",
      updated_at: "2026-04-04T10:00:00.000Z",
      completed_at: null,
    };

    const { recordsModule } = await loadModule({
      rows: [row],
      row,
    });

    await recordsModule.initializeRecordsStorage();
    await expect(recordsModule.listRecords()).resolves.toEqual([
      expect.objectContaining({
        id: "draft-malformed-items",
        values: expect.objectContaining({
          items: [],
        }),
        settlementState: {
          settledParticipantIds: [],
        },
      }),
    ]);
  });

  it("filters malformed placeholder fields that resolve through nullish item values", async () => {
    const row = {
      id: "draft-nullish-fields",
      status: "draft",
      step: 2,
      payload: JSON.stringify({
        currency: "EUR",
        payerParticipantId: "",
        participants: [{ id: "ana", name: "Ana" }],
        items: [
          {
            id: "placeholder-nullish",
            name: null,
            price: null,
            category: null,
            splitMode: "even",
            allocations: [],
          },
        ],
      }),
      created_at: "2026-04-04T09:00:00.000Z",
      updated_at: "2026-04-04T10:00:00.000Z",
      completed_at: null,
    };

    const { recordsModule } = await loadModule({
      rows: [row],
      row,
    });

    await recordsModule.initializeRecordsStorage();
    await expect(recordsModule.getRecordById("draft-nullish-fields")).resolves.toEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          items: [],
        }),
        settlementState: {
          settledParticipantIds: [],
        },
      })
    );
  });

  it("loads settlement state from the new wrapped payload shape", async () => {
    const row = {
      id: "draft-settlement",
      status: "draft",
      step: 4,
      payload: JSON.stringify({
        values: {
          splitName: "",
          currency: "EUR",
          payerParticipantId: "ana",
          participants: [{ id: "ana", name: "Ana" }, { id: "bruno", name: "Bruno" }],
          items: [],
        },
        settlementState: {
          settledParticipantIds: ["bruno"],
        },
      }),
      created_at: "2026-04-04T09:00:00.000Z",
      updated_at: "2026-04-04T10:00:00.000Z",
      completed_at: null,
    };

    const { recordsModule } = await loadModule({
      rows: [row],
      row,
    });

    await recordsModule.initializeRecordsStorage();
    await expect(recordsModule.getRecordById("draft-settlement")).resolves.toEqual(
      expect.objectContaining({
        settlementState: {
          settledParticipantIds: ["bruno"],
        },
      })
    );
  });
});
