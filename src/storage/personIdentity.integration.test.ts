import { mkdtempSync, existsSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Exercise the actual SQLite engine, including transactions and query plans.
const { DatabaseSync, backup } = require("node:sqlite");
const { randomUUID } = require("node:crypto");

describe("person identity SQLite migration and membership persistence", () => {
  let directory: string;
  let connections: any[];
  let database: any;
  let records: typeof import("./records");
  let migration: typeof import("./personIdentityMigration");
  let memberships: typeof import("./personMemberships");
  let failSql: string | null;
  let beforeRun: ((sql: string) => Promise<void>) | null;
  let failBackup: boolean;

  beforeEach(async () => {
    jest.resetModules();
    directory = mkdtempSync(join(tmpdir(), "split-person-migration-"));
    connections = [];
    failSql = null;
    beforeRun = null;
    failBackup = false;
    const open = async (name: string) => {
      const path = join(directory, name);
      const sync = new DatabaseSync(path);
      sync.exec("PRAGMA foreign_keys = ON");
      const connection: any = {
        sync,
        databasePath: path,
        execAsync: async (sql: string) => sync.exec(sql),
        getAllAsync: async (sql: string, args: any[] = []) =>
          sync
            .prepare(sql)
            .all(...args)
            .map((entry: any) => ({ ...entry })),
        getFirstAsync: async (sql: string, args: any[] = []) => {
          const entry = sync.prepare(sql).get(...args);
          return entry ? { ...entry } : null;
        },
        runAsync: async (sql: string, args: any[] = []) => {
          await beforeRun?.(sql);
          if (failSql && sql.includes(failSql))
            throw new Error("injected persistence failure");
          return sync.prepare(sql).run(...args);
        },
        withExclusiveTransactionAsync: async (
          operation: (tx: any) => Promise<void>,
        ) => {
          sync.exec("BEGIN IMMEDIATE");
          try {
            await operation(connection);
            sync.exec("COMMIT");
          } catch (error) {
            sync.exec("ROLLBACK");
            throw error;
          }
        },
        closeAsync: async () => {
          sync.close();
          connection.closed = true;
        },
      };
      connections.push(connection);
      return connection;
    };
    jest.doMock("expo-sqlite", () => ({
      openDatabaseAsync: open,
      defaultDatabaseDirectory: directory,
      backupDatabaseAsync: async ({ sourceDatabase, destDatabase }: any) => {
        if (failBackup) throw new Error("injected backup failure");
        await destDatabase.closeAsync();
        await backup(sourceDatabase.sync, destDatabase.databasePath);
        // Backup verification uses a separately reopened connection below.
        const replacement = await open(
          destDatabase.databasePath.split(/[\\/]/).pop()!,
        );
        Object.assign(destDatabase, replacement);
      },
    }));
    jest.doMock("expo-modules-core", () => ({
      ...jest.requireActual("expo-modules-core"),
      uuid: { v4: randomUUID },
    }));
    jest.doMock("expo-file-system/legacy", () => ({
      getInfoAsync: async (path: string) => ({
        exists: existsSync(path.replace(/^file:\/\//, "")),
      }),
      deleteAsync: async (path: string) => {
        const local = path.replace(/^file:\/\//, "");
        if (existsSync(local)) rmSync(local);
      },
      moveAsync: async ({ from, to }: any) =>
        renameSync(
          from.replace(/^file:\/\//, ""),
          to.replace(/^file:\/\//, ""),
        ),
    }));
    jest.doMock("../lib/device", () => ({
      getDeviceLocale: () => "en-US",
      cloneDeep: (value: unknown) => JSON.parse(JSON.stringify(value)),
    }));
    records = require("./records");
    migration = require("./personIdentityMigration");
    memberships = require("./personMemberships");
    const settings = require("./settings");
    await settings.initializeSettingsStorage();
    await records.initializeRecordsStorage();
    database = connections[0];
  });

  afterEach(async () => {
    for (const connection of connections)
      if (!connection.closed) {
        try {
          await connection.closeAsync();
        } catch {
          /* Already closed backup connection. */
        }
      }
    rmSync(directory, { recursive: true, force: true });
  });

  const raw = (id: string, name = "Ana") => ({
    id,
    status: "completed",
    step: 6,
    payload: JSON.stringify({
      currency: "EUR",
      participants: [{ id: `${id}-local`, name }],
      payerParticipantId: `${id}-local`,
      items: [],
      extra: "preserve",
    }),
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
    completed_at: "2026-01-02",
  });
  async function seed(row = raw("old")) {
    await database.runAsync(
      "INSERT INTO split_records VALUES (?, ?, ?, ?, ?, ?, ?)",
      Object.values(row),
    );
    return row;
  }

  async function loadPersistedStore() {
    const { useSplitStore } = require("../features/split/store");
    const settings = await require("./settings").getAppSettings();
    const stored = await records.listRecords();
    useSplitStore.setState({
      ready: true,
      records: stored,
      settings,
      activeRecordId: stored[0]?.id ?? null,
    });
    return useSplitStore as typeof import("../features/split/store").useSplitStore;
  }

  it("persists group creation, metadata edits, and deletion without changing people or split history", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const original = await readRows();
    const anaId = store.getState().records[0].values.participants[0].personId!;
    await expect(
      store.getState().addParticipantGroup(
        "Roomies",
        [anaId],
        {
          description: "Shared groceries",
          icon: "home",
          color: "#123456",
        },
        ["Bruno", " BRUNO "],
      ),
    ).resolves.toBe(true);
    const created = store.getState().settings.participantGroups![0];
    expect(created.memberPersonIds).toHaveLength(2);
    expect(
      store
        .getState()
        .settings.people!.filter((person) => person.name === "Bruno"),
    ).toHaveLength(1);
    await expect(
      store.getState().updateParticipantGroup(created.id, {
        name: "Roommates",
        memberPersonIds: created.memberPersonIds,
        description: "Rent and groceries",
        icon: "plane",
        color: "mint",
      }),
    ).resolves.toBe(true);
    const persisted = await require("./settings").getAppSettings();
    expect(persisted.participantGroups[0]).toMatchObject({
      id: created.id,
      name: "Roommates",
      description: "Rent and groceries",
      icon: "plane",
      color: "mint",
      usageCount: 0,
      createdAt: created.createdAt,
    });
    await store.getState().removeParticipantGroup(created.id);
    const deleted = await require("./settings").getAppSettings();
    expect(deleted.participantGroups).toEqual([]);
    expect(deleted.people).toEqual(persisted.people);
    expect(await readRows()).toEqual(original);
    await memberships.verifyPersonMemberships(database);
  });

  it("restores archived names atomically when creating and editing groups", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const anaId = store.getState().records[0].values.participants[0].personId!;
    const originalSplit = await records.getRecordById("old");
    await expect(store.getState().removePerson(anaId)).resolves.toBe("archived");
    expect(store.getState().settings.people!.find((person) => person.id === anaId)?.archivedAt).toBeTruthy();

    await expect(store.getState().addParticipantGroup("Roomies", [], {}, ["  ANA  "])).resolves.toBe(true);
    let settings = await require("./settings").getAppSettings();
    expect(settings.people.filter((person: any) => person.name.toLowerCase() === "ana")).toHaveLength(1);
    expect(settings.people.find((person: any) => person.id === anaId)?.archivedAt).toBeFalsy();
    const group = settings.participantGroups[0];
    expect(group.memberPersonIds).toEqual([anaId]);

    await expect(store.getState().removePerson(anaId)).resolves.toBe("archived");
    await expect(store.getState().updateParticipantGroup(group.id, {
      name: group.name,
      memberPersonIds: [],
      newPersonNames: ["Ana"],
    })).resolves.toBe(true);
    settings = await require("./settings").getAppSettings();
    expect(settings.people.find((person: any) => person.id === anaId)?.archivedAt).toBeFalsy();
    expect(settings.participantGroups[0]).toMatchObject({ id: group.id, memberPersonIds: [anaId], usageCount: group.usageCount, createdAt: group.createdAt });
    expect(await records.getRecordById("old")).toEqual(originalSplit);
    await memberships.verifyPersonMemberships(database);
  });

  it("restores an archived split identity only with a newly added participant and rolls it back on failure", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const brunoId = await store.getState().upsertPerson("Bruno");
    await store.getState().addParticipantGroup("Bruno group", [brunoId!]);
    await expect(store.getState().removePerson(brunoId!)).resolves.toBe("archived");

    const localId = "bruno-local";
    await store.getState().updateParticipants((participants) => [...participants, { id: localId, name: " Bruno " }]);
    const restored = await require("./settings").getAppSettings();
    const split = await records.getRecordById("old");
    expect(restored.people.find((person: any) => person.id === brunoId)?.archivedAt).toBeFalsy();
    expect(split!.values.participants.find((participant) => participant.id === localId)).toMatchObject({ id: localId, name: "Bruno", personId: brunoId });
    expect(await memberships.countRecordsForPerson(brunoId!)).toBe(1);

    const carlaId = await store.getState().upsertPerson("Carla");
    await store.getState().addParticipantGroup("Carla group", [carlaId!]);
    await expect(store.getState().removePerson(carlaId!)).resolves.toBe("archived");
    const beforeFailure = await records.getRecordById("old");
    failSql = "INSERT INTO app_settings";
    await expect(store.getState().updateParticipants((participants) => [...participants, { id: "carla-local", name: "Carla" }])).rejects.toThrow("injected persistence failure");
    failSql = null;

    const failedSettings = await require("./settings").getAppSettings();
    expect(failedSettings.people.find((person: any) => person.id === carlaId)?.archivedAt).toBeTruthy();
    expect(await records.getRecordById("old")).toEqual(beforeFailure);
    expect(store.getState().getActiveRecord()!.values.participants.some((participant) => participant.id === "carla-local")).toBe(false);
    await memberships.verifyPersonMemberships(database);
  });

  it("does not publish an archived-name group restoration when its transaction fails", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const brunoId = await store.getState().upsertPerson("Bruno");
    await store.getState().addParticipantGroup("Original group", [brunoId!]);
    await store.getState().removePerson(brunoId!);
    const groupsBefore = await require("./settings").getAppSettings();
    failSql = "INSERT INTO app_settings";

    await expect(store.getState().addParticipantGroup("Retry group", [], {}, ["Bruno"])).rejects.toThrow("injected persistence failure");
    failSql = null;

    const persisted = await require("./settings").getAppSettings();
    expect(persisted.participantGroups).toEqual(groupsBefore.participantGroups);
    expect(persisted.people.find((person: any) => person.id === brunoId)?.archivedAt).toBeTruthy();
    expect(store.getState().settings.participantGroups).toEqual(groupsBefore.participantGroups);
  });

  async function readRows() {
    return database.getAllAsync("SELECT * FROM split_records ORDER BY id");
  }

  it("increments only the explicitly used group when members overlap and preserves indexed identities", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const anaId = store.getState().records[0].values.participants[0].personId!;
    await store.getState().addParticipantGroup("A", [anaId], {}, ["Bruno"]);
    const brunoId = store
      .getState()
      .settings.people!.find((person) => person.name === "Bruno")!.id;
    await store.getState().addParticipantGroup("B", [brunoId], {}, ["Carla"]);
    const [groupA, groupB] = store.getState().settings.participantGroups!;
    await store
      .getState()
      .addParticipantsFromGroup(groupA.id, [anaId, brunoId]);
    let persisted = await require("./settings").getAppSettings();
    expect(
      persisted.participantGroups.map((group: any) => group.usageCount),
    ).toEqual([1, 0]);
    expect(await memberships.countRecordsForPerson(brunoId)).toBe(1);
    const carlaId = store
      .getState()
      .settings.people!.find((person) => person.name === "Carla")!.id;
    await store.getState().addParticipantsFromGroup(groupB.id, [carlaId]);
    persisted = await require("./settings").getAppSettings();
    expect(
      persisted.participantGroups.map((group: any) => group.usageCount),
    ).toEqual([1, 1]);
    const [saved] = await records.listRecords();
    expect(saved.values.participants.map((person) => person.name)).toEqual([
      "Ana",
      "Bruno",
      "Carla",
    ]);
    expect(saved.values.participants[0]).toMatchObject({
      id: "old-local",
      personId: anaId,
    });
    await memberships.verifyPersonMemberships(database);
  });

  it("publishes a new split participant with global identity and saves person, split, and membership together", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const initial = store.getState().records[0];
    const ana = initial.values.participants[0];
    const operation = store.getState().updateParticipants([
      ana,
      { id: "bruno-local", name: "Bruno" },
    ]);
    const optimistic = store.getState().getActiveRecord()!.values.participants[1];
    expect(optimistic).toMatchObject({ id: "bruno-local", name: "Bruno", personId: expect.any(String) });
    expect(store.getState().settings.people!.some((person) => person.id === optimistic.personId)).toBe(false);

    await operation;
    const saved = await records.getRecordById(initial.id);
    const savedPerson = (await require("./settings").getAppSettings()).people.find((person: any) => person.id === optimistic.personId);
    expect(saved!.values.participants[1]).toEqual(optimistic);
    expect(savedPerson).toMatchObject({ id: optimistic.personId, name: "Bruno" });
    expect(await memberships.countRecordsForPerson(optimistic.personId!)).toBe(1);
    expect(saved!.values.payerParticipantId).toBe(initial.values.payerParticipantId);
  });

  it("does not publish an inline person or group when the SQLite settings write fails", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const before = await require("./settings").getAppSettings();
    failSql = "INSERT INTO app_settings";
    await expect(store.getState().addParticipantGroup("Roomies", [], {}, ["Bruno"])).rejects.toThrow("injected persistence failure");
    expect(store.getState().settings.participantGroups).toEqual(before.participantGroups);
    expect(store.getState().settings.people).toEqual(before.people);
    expect(await require("./settings").getAppSettings()).toEqual(before);
  });

  it("keeps global identities consistent through overlapping participant additions", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const first = store.getState().updateParticipants((participants) => [...participants, { id: "bruno-local", name: "Bruno" }]);
    const second = store.getState().updateParticipants((participants) => [...participants, { id: "carla-local", name: "Carla" }]);
    expect(store.getState().getActiveRecord()!.values.participants.every((person) => Boolean(person.personId))).toBe(true);
    await Promise.all([first, second]);
    const persisted = await records.getRecordById("old");
    expect(store.getState().getActiveRecord()!.values.participants).toEqual(persisted!.values.participants);
    expect(persisted!.values.participants.map((person) => person.name)).toEqual(["Ana", "Bruno", "Carla"]);
    await memberships.verifyPersonMemberships(database);
  });

  it("reuses a pending normalized identity across splits without changing the selected split", async () => {
    await seed(raw("first"));
    await seed(raw("second"));
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    store.setState({ activeRecordId: "first" });
    const first = store.getState().updateParticipants((participants) => [...participants, { id: "bruno-first", name: "Bruno" }]);
    const firstPersonId = store.getState().getActiveRecord()!.values.participants[1].personId;
    store.setState({ activeRecordId: "second" });
    const second = store.getState().updateParticipants((participants) => [...participants, { id: "bruno-second", name: "  BRUNO  " }]);
    expect(store.getState().getActiveRecord()!.values.participants[1].personId).toBe(firstPersonId);
    await Promise.all([first, second]);
    expect(store.getState().activeRecordId).toBe("second");
    expect(await memberships.countRecordsForPerson(firstPersonId!)).toBe(2);
    const saved = await require("./settings").getAppSettings();
    expect(saved.people.filter((person: any) => person.name.toLowerCase() === "bruno")).toHaveLength(1);
    await memberships.verifyPersonMemberships(database);
  });

  it("restores committed state after two overlapping participant saves fail", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    failSql = "INSERT INTO app_settings";
    const first = store.getState().updateParticipants((participants) => [...participants, { id: "bruno-local", name: "Bruno" }]);
    const second = store.getState().updateParticipants((participants) => [...participants, { id: "carla-local", name: "Carla" }]);
    const outcomes = await Promise.allSettled([first, second]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["rejected", "rejected"]);
    const persisted = await records.getRecordById("old");
    expect(store.getState().getActiveRecord()!.values.participants).toEqual(persisted!.values.participants);
  });

  it("preserves a split edit started while a person save is in flight", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const ana = store.getState().getActiveRecord()!.values.participants[0];
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => { enter = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    beforeRun = async (sql) => {
      if (!sql.includes("INSERT INTO app_settings")) return;
      beforeRun = null;
      enter();
      await gate;
    };
    const saving = store.getState().savePerson({ personId: ana.personId!, name: "Ana Maria", photoUri: null, color: "mint", groupIds: [] });
    await entered;
    const adding = store.getState().updateParticipants((participants) => [...participants, { id: "bruno-local", name: "Bruno" }]);
    release();
    const results = await Promise.all([saving, adding]);
    expect(results[0]).toEqual({ ok: true, personId: ana.personId });
    const persisted = await records.getRecordById("old");
    expect(store.getState().getActiveRecord()!.values.participants).toEqual(persisted!.values.participants);
    expect(persisted!.values.participants.map((person) => person.name)).toEqual(["Ana Maria", "Bruno"]);
  });

  it("retains the committed owner name when a profile rename conflicts with a saved person", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const before = await require("./settings").getAppSettings();
    await expect(store.getState().updateSettings({ ownerName: "Ana" })).rejects.toThrow("Owner name conflicts with a saved person");
    expect((await require("./settings").getAppSettings()).ownerName).toBe(before.ownerName);
    expect(store.getState().settings.ownerName).toBe(before.ownerName);
  });

  it("rolls overlapping failed owner-name edits back to the last persisted name", async () => {
    await seed(raw("old", "You"));
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    failSql = "INSERT INTO app_settings";

    const first = store.getState().updateSettings({ ownerName: "First" });
    const second = store.getState().updateSettings({ ownerName: "Second" });
    expect(store.getState().settings.ownerName).toBe("Second");
    const outcomes = await Promise.allSettled([first, second]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(["rejected", "rejected"]);
    expect((await require("./settings").getAppSettings()).ownerName).toBe("You");
    expect(store.getState().settings.ownerName).toBe("You");
    expect(store.getState().records[0].values.participants[0].name).toBe("You");
    expect((await records.getRecordById("old"))!.values.participants[0].name).toBe("You");
  });

  it("keeps group edits and deletion in memory only after their settings transaction succeeds", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const personId = store.getState().records[0].values.participants[0].personId!;
    await store.getState().addParticipantGroup("Roomies", [personId]);
    const before = await require("./settings").getAppSettings();
    const group = before.participantGroups[0];
    failSql = "INSERT INTO app_settings";
    await expect(store.getState().updateParticipantGroup(group.id, { name: "Household", memberPersonIds: [personId] })).rejects.toThrow("injected persistence failure");
    expect(store.getState().settings.participantGroups).toEqual(before.participantGroups);
    await expect(store.getState().removeParticipantGroup(group.id)).rejects.toThrow("injected persistence failure");
    expect(store.getState().settings.participantGroups).toEqual(before.participantGroups);
    expect((await require("./settings").getAppSettings()).participantGroups).toEqual(before.participantGroups);
  });

  it("renames a global person across persisted splits without changing financial references or indexed memberships", async () => {
    const participants = [
      { id: "a", name: "Ana" },
      { id: "b", name: "Bruno" },
    ];
    const values = {
      ...require("../domain").createDefaultValues("en-US"),
      participants,
      payerParticipantId: "a",
      items: [
        {
          id: "meal",
          name: "Dinner",
          price: "12.00",
          splitMode: "even",
          allocations: participants.map((person) => ({
            participantId: person.id,
            evenIncluded: true,
            shares: "1",
            percent: "50",
            percentLocked: false,
          })),
        },
      ],
    };
    const payload = JSON.stringify({
      values,
      settlementState: { settledParticipantIds: ["b"] },
    });
    await seed({ ...raw("first"), payload });
    await seed({ ...raw("second"), payload });
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const anaId = store.getState().records[0].values.participants[0].personId!;
    const before = await records.listRecords();
    const compute = require("../domain").computeSettlement;
    const initialSettlement = compute(before[0].values);
    expect(initialSettlement.ok).toBe(true);
    await expect(
      store
        .getState()
        .savePerson({
          personId: anaId,
          name: "Ana Maria",
          photoUri: null,
          color: "mint",
          groupIds: [],
        }),
    ).resolves.toEqual({ ok: true, personId: anaId });
    const after = await records.listRecords();
    for (const record of after) {
      const previous = before.find((entry) => entry.id === record.id)!;
      expect(record.values.participants[0]).toEqual({
        id: "a",
        name: "Ana Maria",
        personId: anaId,
      });
      expect(record.values.items).toEqual(previous.values.items);
      expect(record.values.payerParticipantId).toBe(
        previous.values.payerParticipantId,
      );
      expect(record.settlementState).toEqual(previous.settlementState);
      const settlement = compute(record.values);
      expect(settlement.ok).toBe(true);
      expect(
        settlement.data.people.map((person: any) => person.netCents),
      ).toEqual(
        initialSettlement.data.people.map((person: any) => person.netCents),
      );
    }
    expect(await memberships.countRecordsForPerson(anaId)).toBe(2);
    await memberships.verifyPersonMemberships(database);
  });

  it("creates a saved person and group membership atomically without changing split history", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const before = await records.listRecords();
    const anaId = before[0].values.participants[0].personId!;
    await store.getState().addParticipantGroup("Roomies", [anaId]);
    const group = (store.getState().settings.participantGroups ?? [])[0]!;

    const result = await store.getState().savePerson({
      personId: null,
      name: "Carla",
      photoUri: null,
      color: "mint",
      groupIds: [group.id],
    });

    expect(result.ok).toBe(true);
    const persistedSettings = await require("./settings").getAppSettings();
    const carla = persistedSettings.people.find((person: any) => person.name === "Carla");
    expect(carla).toMatchObject({ name: "Carla", color: "mint" });
    expect(persistedSettings.participantGroups[0].memberPersonIds).toEqual([anaId, carla.id]);
    expect(await records.listRecords()).toEqual(before);
  });

  it("backs up raw history, links automatically, uses the index, and does not rerun migration", async () => {
    await seed();
    await seed(raw("second", " ANA "));
    await migration.migratePersonIdentity();
    const rows = await records.listRecords();
    const personId = rows[0].values.participants[0].personId!;
    expect(rows[1].values.participants[0].personId).toBe(personId);
    expect(await memberships.countRecordsForPerson(personId)).toBe(2);
    expect(await memberships.countRecordsForPerson(personId, "draft")).toBe(0);
    expect(await memberships.listRecordIdsForPerson(personId)).toEqual([
      "old",
      "second",
    ]);
    const query = await database.getAllAsync(
      "EXPLAIN QUERY PLAN SELECT split_id FROM split_person_memberships WHERE person_id = ?",
      [personId],
    );
    expect(JSON.stringify(query)).toContain(
      "split_person_memberships_by_person",
    );
    const before = await database.getAllAsync(
      "SELECT * FROM split_records ORDER BY id",
    );
    await migration.migratePersonIdentity();
    expect(
      await database.getAllAsync("SELECT * FROM split_records ORDER BY id"),
    ).toEqual(before);
    expect(existsSync(join(directory, migration.PERSON_IDENTITY_BACKUP))).toBe(
      true,
    );
    await memberships.rebuildPersonMemberships();
    expect(await memberships.countRecordsForPerson(personId)).toBe(2);
  });

  it("rolls back an interrupted migration and safely retries using the retained backup", async () => {
    const original = await seed();
    failSql = "INSERT INTO split_person_memberships";
    await expect(migration.migratePersonIdentity()).rejects.toThrow("injected");
    expect(
      (
        await database.getFirstAsync(
          "SELECT payload FROM split_records WHERE id = ?",
          [original.id],
        )
      ).payload,
    ).toBe(original.payload);
    expect(
      await database.getAllAsync("SELECT * FROM identity_migrations"),
    ).toEqual([]);
    failSql = null;
    await migration.migratePersonIdentity();
    expect(
      await database.getAllAsync("SELECT * FROM split_person_memberships"),
    ).toHaveLength(1);
  });

  it("saves newly named people and split memberships atomically, including deletion and reassignment", async () => {
    await migration.migratePersonIdentity();
    const record: any = {
      id: "new",
      status: "draft",
      step: 2,
      createdAt: "now",
      updatedAt: "now",
      values: {
        currency: "EUR",
        participants: [{ id: "local", name: "Ana" }],
        payerParticipantId: "local",
        items: [],
      },
      settlementState: { settledParticipantIds: [] },
    };
    const saved = await records.saveRecord(record);
    const ana = saved.record.values.participants[0].personId;
    expect(await memberships.countRecordsForPerson(ana)).toBe(1);
    failSql = "INSERT INTO split_person_memberships";
    await expect(
      records.saveRecord({
        ...saved.record,
        values: {
          ...saved.record.values,
          participants: [
            ...saved.record.values.participants,
            { id: "other-local", name: "Bruno" },
          ],
        },
      }),
    ).rejects.toThrow("injected");
    expect(await memberships.countRecordsForPerson(ana)).toBe(1);
    expect(
      JSON.parse(
        (
          await database.getFirstAsync(
            "SELECT payload FROM app_settings WHERE key = ?",
            ["app-settings"],
          )
        ).payload,
      ).people.some((entry: any) => entry.name === "Bruno"),
    ).toBe(false);
    failSql = null;
    const bruno = {
      id: randomUUID(),
      name: "Bruno",
      createdAt: "now",
      updatedAt: "now",
    };
    const reassignedSnapshot = await records.saveRecordsAndSettings(
      [
        {
          ...saved.record,
          values: {
            ...saved.record.values,
            participants: [{ id: "local", name: "Bruno", personId: bruno.id }],
          },
        },
      ],
      { ...saved.settings, people: [...saved.settings.people!, bruno] },
    );
    const reassigned = { record: reassignedSnapshot.records[0] };
    expect(reassigned.record.values.participants[0].id).toBe("local");
    expect(await memberships.countRecordsForPerson(ana)).toBe(0);
    await records.deleteRecord("new");
    expect(
      await database.getAllAsync("SELECT * FROM split_person_memberships"),
    ).toEqual([]);
  });

  it("rejects malformed history before modifying or dropping any records", async () => {
    await seed({ ...raw("invalid"), payload: "{broken" });
    await expect(migration.migratePersonIdentity()).rejects.toThrow();
    expect(
      await database.getAllAsync("SELECT * FROM split_records"),
    ).toHaveLength(1);
  });

  it("does not mutate history when backup creation fails", async () => {
    const original = await seed();
    failBackup = true;
    await expect(migration.migratePersonIdentity()).rejects.toThrow(
      "backup failure",
    );
    expect(
      (
        await database.getFirstAsync(
          "SELECT payload FROM split_records WHERE id = ?",
          [original.id],
        )
      ).payload,
    ).toBe(original.payload);
    expect(
      await database.getAllAsync("SELECT * FROM identity_migrations"),
    ).toEqual([]);
    failBackup = false;
    await migration.migratePersonIdentity();
    expect(
      await database.getAllAsync("SELECT * FROM split_person_memberships"),
    ).toHaveLength(1);
  });

  it("retains and verifies the original backup rather than overwriting changed source history", async () => {
    await seed();
    failSql = "INSERT INTO split_person_memberships";
    await expect(migration.migratePersonIdentity()).rejects.toThrow("injected");
    failSql = null;
    await database.runAsync(
      "UPDATE split_records SET updated_at = ? WHERE id = ?",
      ["later-edit", "old"],
    );
    await expect(migration.migratePersonIdentity()).rejects.toThrow(
      "backup does not match",
    );
    expect(
      (
        await database.getFirstAsync(
          "SELECT updated_at FROM split_records WHERE id = ?",
          ["old"],
        )
      ).updated_at,
    ).toBe("later-edit");
    expect(
      await database.getAllAsync("SELECT * FROM identity_migrations"),
    ).toEqual([]);
  });

  it("enforces foreign keys on the actual transaction connection", async () => {
    await migration.migratePersonIdentity();
    const { withDatabaseTransaction } = require("./database");
    await expect(
      withDatabaseTransaction((tx: any) =>
        tx.runAsync("INSERT INTO split_person_memberships VALUES (?, ?, ?)", [
          "missing-split",
          "local",
          "person",
        ]),
      ),
    ).rejects.toThrow("FOREIGN KEY");
  });

  it("rejects duplicate, missing, and accidentally omitted existing identities", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const [record] = await records.listRecords();
    await expect(
      records.saveRecord({
        ...record,
        values: {
          ...record.values,
          participants: [{ id: "old-local", name: "Ana" }],
        },
      }),
    ).rejects.toThrow("cannot be omitted");
    await expect(
      records.saveRecord({
        ...record,
        values: {
          ...record.values,
          participants: [{ id: "old-local", name: "Ana", personId: "missing" }],
        },
      }),
    ).rejects.toThrow("missing person");
    await expect(
      records.saveRecord({
        ...record,
        values: {
          ...record.values,
          participants: [
            ...record.values.participants,
            { ...record.values.participants[0], id: "other" },
          ],
        },
      }),
    ).rejects.toThrow("more than once");
    expect(
      await memberships.countRecordsForPerson(
        record.values.participants[0].personId!,
      ),
    ).toBe(1);
  });

  it("serializes concurrent person creation without losing either identity", async () => {
    await migration.migratePersonIdentity();
    const make = (id: string, name: string): any => ({
      id,
      status: "draft",
      step: 2,
      createdAt: "now",
      updatedAt: "now",
      values: {
        currency: "EUR",
        payerParticipantId: "",
        participants: [{ id: "local", name }],
        items: [],
      },
      settlementState: { settledParticipantIds: [] },
    });
    await Promise.all([
      records.saveRecord(make("a", "Ana")),
      records.saveRecord(make("b", "Bruno")),
    ]);
    const saved = JSON.parse(
      (
        await database.getFirstAsync(
          "SELECT payload FROM app_settings WHERE key = ?",
          ["app-settings"],
        )
      ).payload,
    );
    expect(saved.people.map((entry: any) => entry.name)).toEqual(
      expect.arrayContaining(["Ana", "Bruno"]),
    );
    expect(
      await database.getAllAsync("SELECT * FROM split_person_memberships"),
    ).toHaveLength(2);
  });

  it("rechecks indexed usage at deletion and retains referenced identities and photos", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const [record] = await records.listRecords();
    const anaId = record.values.participants[0].personId!;
    const settings = JSON.parse(
      (
        await database.getFirstAsync(
          "SELECT payload FROM app_settings WHERE key = ?",
          ["app-settings"],
        )
      ).payload,
    );
    const unused = {
      id: "unused",
      name: "Unused",
      photoUri: "file:///unused.jpg",
      createdAt: "now",
      updatedAt: "now",
    };
    const ownerAlias = {
      id: "owner-alias",
      name: "You",
      createdAt: "now",
      updatedAt: "now",
    };
    const owner = settings.people.find(
      (entry: any) => entry.id === settings.ownerPersonId,
    );
    if (owner) owner.name = "Alex";
    settings.ownerName = "Alex";
    settings.people.push(unused, ownerAlias);
    await database.runAsync(
      "UPDATE app_settings SET payload = ? WHERE key = ?",
      [JSON.stringify(settings), "app-settings"],
    );
    const { deleteSavedPerson } = require("./personDeletion");
    const archived = await deleteSavedPerson(anaId);
    expect(archived.result).toBe("archived");
    expect(
      archived.settings.people.find((entry: any) => entry.id === anaId)
        .archivedAt,
    ).toEqual(expect.any(String));
    expect(await memberships.countRecordsForPerson(anaId)).toBe(1);
    const removed = await deleteSavedPerson(unused.id);
    expect(removed.result).toBe("deleted");
    expect(removed.photoUri).toBe(unused.photoUri);
    expect(
      removed.settings.people.some((entry: any) => entry.id === unused.id),
    ).toBe(false);
    expect((await deleteSavedPerson(ownerAlias.id)).result).toBe("deleted");
    expect((await deleteSavedPerson("missing-person")).result).toBe("missing");
    expect((await deleteSavedPerson(settings.ownerPersonId)).result).toBe(
      "missing",
    );
  });

  it("archives people referenced by legacy split rows or groups", async () => {
    await seed();
    await migration.migratePersonIdentity();
    await database.runAsync(
      "INSERT INTO split_records VALUES (?, ?, ?, ?, ?, ?, ?)",
      Object.values(raw("legacy", "Legacy participant")),
    );
    const settings = JSON.parse(
      (
        await database.getFirstAsync(
          "SELECT payload FROM app_settings WHERE key = ?",
          ["app-settings"],
        )
      ).payload,
    );
    settings.people.push(
      {
        id: "legacy-person",
        name: "Legacy participant",
        createdAt: "now",
        updatedAt: "now",
      },
      {
        id: "group-only-person",
        name: "Group-only participant",
        createdAt: "now",
        updatedAt: "now",
      },
    );
    settings.participantGroups = settings.participantGroups ?? [];
    settings.participantGroups.push({
      id: "group-only",
      name: "Group only",
      memberPersonIds: ["group-only-person"],
      usageCount: 0,
      createdAt: "now",
      updatedAt: "now",
    });
    await database.runAsync(
      "UPDATE app_settings SET payload = ? WHERE key = ?",
      [JSON.stringify(settings), "app-settings"],
    );

    const { deleteSavedPerson } = require("./personDeletion");
    expect((await deleteSavedPerson("legacy-person")).result).toBe("archived");
    expect((await deleteSavedPerson("group-only-person")).result).toBe(
      "archived",
    );
  });
});
