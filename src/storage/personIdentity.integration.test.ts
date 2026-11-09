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
      "INSERT INTO split_records (id, status, step, payload, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
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
    expect(store.getState().settings.participantGroups!.find((entry) => entry.id === group.id)?.memberPersonIds).toEqual([]);
    expect(await records.getRecordById("old")).toEqual(originalSplit);
    await expect(store.getState().updateParticipantGroup(group.id, { name: "Renamed", memberPersonIds: [], description: "Updated" })).resolves.toBe(false);
    const emptyGroupSettings = await require("./settings").getAppSettings();
    expect(emptyGroupSettings.participantGroups[0]).toMatchObject({ id: group.id, name: group.name, memberPersonIds: [] });
    await expect(store.getState().addParticipantGroup("Empty new group", [])).resolves.toBe(false);
    await expect(store.getState().updateParticipantGroup(group.id, { name: "Renamed", memberPersonIds: ["missing"] })).resolves.toBe(false);
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

  it("commits group participant additions and usage together", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const anaId = store.getState().records[0].values.participants[0].personId!;
    await store.getState().addParticipantGroup("Roomies", [], {}, ["Bruno"]);
    const group = store.getState().settings.participantGroups![0];
    const before = await records.getRecordById(store.getState().activeRecordId!);

    failSql = "INSERT INTO app_settings";
    await expect(store.getState().addParticipantsFromGroup(group.id)).rejects.toThrow("injected persistence failure");
    failSql = null;

    const afterFailure = await records.getRecordById(before!.id);
    expect(afterFailure!.values.participants).toEqual(before!.values.participants);
    expect((await require("./settings").getAppSettings()).participantGroups[0].usageCount).toBe(0);

    await store.getState().addParticipantsFromGroup(group.id);
    const persistedRecord = await records.getRecordById(before!.id);
    const persistedSettings = await require("./settings").getAppSettings();
    expect(persistedRecord!.values.participants).toHaveLength(2);
    expect(persistedRecord!.values.participants[0]).toMatchObject({ id: "old-local", personId: anaId });
    expect(persistedSettings.participantGroups[0].usageCount).toBe(1);
    expect(store.getState().settings.participantGroups![0].usageCount).toBe(1);
    await memberships.verifyPersonMemberships(database);
  });

  it("rejects reserved owner aliases entered as inline group members", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    const before = await require("./settings").getAppSettings();

    await expect(store.getState().addParticipantGroup("Roomies", [], {}, ["You"]))
      .resolves.toBe(false);

    expect(await require("./settings").getAppSettings()).toEqual(before);
    expect(store.getState().settings.participantGroups).toEqual(before.participantGroups);
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

  it("renames an unloaded owner across batches and rolls back both settings and history on failure", async () => {
    for (let index = 0; index < 105; index += 1) await seed(raw(`owner-${String(index).padStart(3, "0")}`, "You"));
    await seed(raw("unrelated", "Ana"));
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    store.setState({ records: [], activeRecordId: null });
    failSql = "UPDATE split_records SET payload";
    await expect(store.getState().updateSettings({ ownerName: "Alex" })).rejects.toThrow("injected");
    expect(store.getState().settings.ownerName).toBe("You");
    expect((await require("./settings").getAppSettings()).ownerName).toBe("You");
    expect((await records.getRecordById("owner-000"))?.values.participants[0].name).toBe("You");
    failSql = null;
    await store.getState().updateSettings({ ownerName: "Alex" });
    expect((await require("./settings").getAppSettings()).ownerName).toBe("Alex");
    expect((await records.getRecordById("owner-000"))?.values.participants[0].name).toBe("Alex");
    expect((await records.getRecordById("owner-104"))?.values.participants[0].name).toBe("Alex");
    expect((await records.getRecordById("unrelated"))?.values.participants[0].name).toBe("Ana");
  });

  it("boots without loading saved splits and opens a requested split on demand", async () => {
    for (let index = 0; index < 120; index += 1) await seed(raw(`history-${String(index).padStart(3, "0")}`));
    await migration.migratePersonIdentity();
    const listSpy = jest.spyOn(records, "listRecords");
    const store = require("../features/split/store").useSplitStore as typeof import("../features/split/store").useSplitStore;
    await store.getState().bootstrap();
    await store.getState().reconcileReminders();
    expect(store.getState().ready).toBe(true);
    expect(store.getState().records).toEqual([]);
    expect(store.getState().activeRecordId).toBeNull();
    expect(listSpy).not.toHaveBeenCalled();
    expect((await store.getState().openRecord("history-119"))?.id).toBe("history-119");
    expect(store.getState().records.map((record) => record.id)).toEqual(["history-119"]);
    expect(store.getState().activeRecordId).toBe("history-119");
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

  it("skips the completed migration scan while retaining explicit integrity verification", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const reads = jest.spyOn(database, "getAllAsync");
    await migration.migratePersonIdentity();
    expect(reads).not.toHaveBeenCalled();

    await database.runAsync("DELETE FROM split_person_memberships");
    await expect(memberships.verifyPersonMemberships(database)).rejects.toThrow("Person membership index does not match split records");
  });

  it("pages compact split projections in the same order as full records, including legacy dates and timestamp ties", async () => {
    const { listSplitSummaries, listSplitIds } = require("./splitList") as typeof import("./splitList");
    for (let index = 0; index < 37; index += 1) {
      const row = raw(index % 2 ? `id-a${index}` : `id-A${index}`);
      const values = JSON.parse(row.payload);
      values.splitName = `Split ${index}`;
      values.splitDate = index % 4 === 0 ? "2026-02-30" : index % 4 === 1 ? undefined : `2026-01-${String(index % 5 + 1).padStart(2, "0")}`;
      values.tagIds = index % 2 ? [" food ", "trip"] : ["food"];
      values.items = [{ id: "placeholder", name: "Item", price: "" }, { id: "real", name: `Meal ${index}`, price: "1.00" }];
      row.status = index % 3 === 0 ? "draft" : "completed";
      row.created_at = `2026-01-0${index % 3 + 1}T12:00:00.000Z`;
      row.payload = JSON.stringify(index % 2 ? { values, splitDate: "2099-01-01", tagIds: ["incorrect"] } : values);
      await seed(row);
    }
    for (let index = 0; index < 33; index += 1) {
      const row = raw(index % 2 ? `tie-a${index}` : `tie-A${index}`);
      const values = JSON.parse(row.payload);
      values.splitDate = "2026-01-10";
      values.items = [{ id: "meal", name: `Tied meal ${index}`, price: "1.00" }];
      values.tagIds = ["food"];
      row.created_at = "2026-01-10T12:00:00.000Z";
      row.payload = JSON.stringify({ values });
      await seed(row);
    }
    const full = await records.listRecords();
    const summaryPage = await listSplitSummaries({ limit: 7 });
    const idPage = await listSplitIds({ limit: 7 });
    expect(idPage.records).toEqual(summaryPage.records.map(({ id, splitDate, createdAt }) => ({ id, splitDate, createdAt })));
    expect(idPage.nextCursor).toEqual(summaryPage.nextCursor);
    expect(Buffer.byteLength(JSON.stringify(idPage.records))).toBeLessThan(Buffer.byteLength(JSON.stringify(summaryPage.records)));
    for (const order of ["newest", "oldest"] as const) {
      for (const status of ["all", "settled", "unsettled"] as const) {
        const expected = full.filter((record) => status === "all" || (status === "settled" ? record.status === "completed" : record.status !== "completed"));
        if (order === "oldest") expected.reverse();
        const actual: string[] = [];
        let cursor: import("./splitList").SplitListCursor | undefined;
        do {
          const page = await listSplitSummaries({ limit: 7, order, status, cursor });
          for (const summary of page.records) {
            const original = full.find((record) => record.id === summary.id)!;
            expect(summary.splitName).toBe(original.values.splitName);
            expect(summary.firstItemName).toBe(original.values.items[0].name);
            expect(summary.tagIds).toEqual(original.values.tagIds);
          }
          actual.push(...page.records.map((record) => record.id));
          cursor = page.nextCursor ?? undefined;
          if (actual.length > full.length) throw new Error("Pagination repeated a record");
        } while (cursor);
        expect(actual).toEqual(expected.map((record) => record.id));
      }
    }

    const eligible = full.filter((record) => record.id.startsWith("id-")).slice(0, 20);
    const tagged = await listSplitSummaries({ limit: 100, tagIds: ["food", "trip"], tagMode: "all", eligibleIds: eligible.map((record) => record.id) });
    expect(tagged.records.map((record) => record.id)).toEqual(eligible.filter((record) => record.values.tagIds?.includes("trip")).map((record) => record.id));
    const excludedId = full[0].id;
    const anyTag = await listSplitSummaries({ limit: 100, tagIds: ["trip", "missing"], tagMode: "any", excludedId });
    expect(anyTag.records.map((record) => record.id)).toEqual(full.filter((record) => record.id !== excludedId && record.values.tagIds?.includes("trip")).map((record) => record.id));
    expect(await listSplitSummaries({ limit: 20, eligibleIds: [] })).toEqual({ records: [], nextCursor: null });

    const readSpy = jest.spyOn(database, "getAllAsync");
    await listSplitSummaries({ limit: 7 });
    const orderedQueries = readSpy.mock.calls.filter((call) => typeof call[0] === "string" && call[0].includes("ORDER BY"));
    const plans = orderedQueries.map((call) => database.sync.prepare(`EXPLAIN QUERY PLAN ${String(call[0])}`).all(...(call[1] as unknown[])));
    expect(JSON.stringify(plans)).toContain("split_records_list_day");
    expect(JSON.stringify(plans)).toContain("split_records_list_legacy");
  });

  it("returns compact list data for a split with many item allocations", async () => {
    const { listSplitSummaries } = require("./splitList") as typeof import("./splitList");
    const row = raw("large");
    const values = JSON.parse(row.payload);
    values.splitDate = "2026-01-01";
    values.splitName = "Dinner";
    values.items = Array.from({ length: 20 }, (_, index) => ({
      id: `item-${index}`, name: `Item ${index}`, price: "10.00", splitMode: "even",
      allocations: Array.from({ length: 10 }, (_, person) => ({ participantId: `person-${person}`, evenIncluded: true, shares: "1", percent: "10" })),
    }));
    row.payload = JSON.stringify({ values });
    await seed(row);
    const page = await listSplitSummaries({ limit: 5 });
    expect(page.records[0]).toEqual(expect.objectContaining({ id: "large", splitName: "Dinner", firstItemName: "Item 0", currency: "EUR" }));
    expect(Buffer.byteLength(JSON.stringify(page.records))).toBeLessThan(Buffer.byteLength(row.payload) / 10);
  });

  it("projects only participants for requested splits in the requested order", async () => {
    const { getSplitParticipantsByIds } = require("./splitList") as typeof import("./splitList");
    const first = raw("first", "Ana");
    const second = raw("second", "Bruno");
    const values = JSON.parse(second.payload);
    values.items = Array.from({ length: 50 }, (_, index) => ({ id: `item-${index}`, name: "Long item", price: "2.00", allocations: Array(20).fill({ participantId: "person", shares: "1" }) }));
    second.payload = JSON.stringify({ values });
    await seed(first);
    await seed(second);
    const projected = await getSplitParticipantsByIds(["second", "missing", "first", "second"]);
    expect(projected.map((record) => record.id)).toEqual(["second", "first"]);
    expect(projected.map((record) => record.values.participants[0].name)).toEqual(["Bruno", "Ana"]);
    expect(Buffer.byteLength(JSON.stringify(projected))).toBeLessThan(Buffer.byteLength(second.payload) / 10);
    expect(await getSplitParticipantsByIds([])).toEqual([]);
    await expect(getSplitParticipantsByIds(Array.from({ length: 101 }, (_, index) => String(index)))).rejects.toThrow("Participant batch exceeds 100 IDs");
  });

  it("ranks frequent people from all pages with the same rules as full history", async () => {
    const names = ["You", "Ana", "Bruno", "Álvaro", "ana", "Carla"];
    for (let index = 0; index < 105; index += 1) {
      const row = raw(`friend-${String(index).padStart(3, "0")}`, names[index % names.length]);
      row.created_at = `2026-01-${String(index % 20 + 1).padStart(2, "0")}T12:00:00.000Z`;
      await seed(row);
    }
    const { scanFrequentFriends } = require("../features/split/screens/flow/scanFrequentFriends") as typeof import("../features/split/screens/flow/scanFrequentFriends");
    const { getFrequentFriends } = require("../features/split/screens/shared/participantUtils") as typeof import("../features/split/screens/shared/participantUtils");
    const full = await records.listRecords();
    const expected = getFrequentFriends(full, "friend-010", "You", { people: [] });
    const actual = await scanFrequentFriends({ activeDraftId: "friend-010", ownerName: "You", people: [], isCancelled: () => false });
    expect(actual).toEqual(expected);
    expect(actual?.slice(1).map((person) => person.name.toLowerCase())).toContain("ana");
  });

  it("computes the same balances from bounded archive batches as full records", async () => {
    const { createDefaultValues } = require("../domain") as typeof import("../domain");
    for (let index = 0; index < 30; index += 1) {
      const row = raw(`balance-${String(index).padStart(2, "0")}`);
      const values = { ...createDefaultValues(), currency: index % 2 ? "USD" : "EUR",
        participants: [{ id: "owner", name: "You" }, { id: "friend", name: "Ana" }], payerParticipantId: "owner",
        items: [{ id: "item", name: "Dinner", price: "10.00", splitMode: "even", allocations: ["owner", "friend"].map((participantId) => ({ participantId, evenIncluded: true, shares: "1", percent: "50" })) }],
        ...(index % 2 ? { exchangeRate: { sourceCurrency: "USD", targetCurrency: "EUR", rate: 0.5 } } : {}),
      };
      row.payload = JSON.stringify({ values, settlementState: { settledParticipantIds: index % 3 ? [] : ["friend"] } });
      await seed(row);
    }
    const { scanHomeBalances } = require("../features/split/screens/home/scanHomeBalances") as typeof import("../features/split/screens/home/scanHomeBalances");
    const { getHomeBalanceCards, getHomeBalanceCardsFromEntries } = require("../features/split/screens/shared/settlementUtils") as typeof import("../features/split/screens/shared/settlementUtils");
    const entries = await scanHomeBalances({ ownerName: "You", currency: "EUR", isCancelled: () => false });
    expect(entries).toHaveLength(30);
    expect(getHomeBalanceCardsFromEntries(entries!, "EUR")).toEqual(getHomeBalanceCards(await records.listRecords(), "You", "EUR"));
    expect(getHomeBalanceCardsFromEntries(entries!, "EUR").owedCents).toBe(7500);
    expect((await database.getFirstAsync("SELECT COUNT(*) AS count FROM split_records WHERE financial_projection IS NOT NULL")).count).toBe(30);
    const cachedEntries = await scanHomeBalances({ ownerName: "You", currency: "EUR", isCancelled: () => false });
    expect(cachedEntries).toEqual(entries);
    const otherCurrency = await scanHomeBalances({ ownerName: "You", currency: "USD", isCancelled: () => false });
    expect(getHomeBalanceCardsFromEntries(otherCurrency!, "USD")).toEqual(getHomeBalanceCards(await records.listRecords(), "You", "USD"));
    const otherOwner = await scanHomeBalances({ ownerName: "Ana", currency: "EUR", isCancelled: () => false });
    expect(getHomeBalanceCardsFromEntries(otherOwner!, "EUR")).toEqual(getHomeBalanceCards(await records.listRecords(), "Ana", "EUR"));
  });

  it("loads only requested records in the requested order, including after deletion", async () => {
    await seed(raw("first"));
    await seed(raw("second"));
    await seed(raw("third"));
    expect((await records.getRecordsByIds(["third", "missing", "first", "third"])).map((record) => record.id)).toEqual(["third", "first"]);
    await records.deleteRecord("third");
    expect((await records.getRecordsByIds(["third", "second"])).map((record) => record.id)).toEqual(["second"]);
    expect(await records.getRecordsByIds([])).toEqual([]);
    await expect(records.getRecordsByIds(Array.from({ length: 101 }, (_, index) => String(index)))).rejects.toThrow("Record batch exceeds 100 IDs");
  });

  it("writes financial data atomically with a split and recovers after a failed write", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const original = (await records.getRecordById("old"))!;
    await records.getFinancialProjectionsByIds(["old"]);
    const before = await database.getFirstAsync("SELECT payload, financial_projection FROM split_records WHERE id = ?", ["old"]);
    const edited = { ...original, settlementState: { settledParticipantIds: ["some-person"] } };
    failSql = "UPDATE split_records SET financial_projection";
    await expect(records.saveRecord(edited)).rejects.toThrow("injected");
    expect(await database.getFirstAsync("SELECT payload, financial_projection FROM split_records WHERE id = ?", ["old"])).toEqual(before);
    failSql = null;
    await records.saveRecord(edited);
    const projection = await records.getFinancialProjectionsByIds(["old"]);
    expect(projection[0].projection.settledParticipantIds).toEqual(["some-person"]);
    expect((await records.getRecordById("old"))!.settlementState.settledParticipantIds).toEqual(["some-person"]);
  });

  it("does not backfill a financial projection from a concurrently changed payload", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const getAll = database.getAllAsync.bind(database);
    let changed = false;
    database.getAllAsync = async (sql: string, args: any[]) => {
      const rows = await getAll(sql, args);
      if (!changed && sql.includes("CASE WHEN financial_projection IS NULL THEN payload")) {
        changed = true;
        const row = await database.getFirstAsync("SELECT payload FROM split_records WHERE id = ?", ["old"]);
        const payload = JSON.parse(row.payload);
        payload.settlementState = { settledParticipantIds: ["new-payment"] };
        await database.runAsync("UPDATE split_records SET payload = ? WHERE id = ?", [JSON.stringify(payload), "old"]);
      }
      return rows;
    };
    const projected = await records.getFinancialProjectionsByIds(["old"]);
    expect(projected[0].projection.settledParticipantIds).toEqual(["new-payment"]);
    const stored = await database.getFirstAsync("SELECT financial_projection FROM split_records WHERE id = ?", ["old"]);
    expect(stored.financial_projection).toBeNull();
  });

  it("pages reminder candidates and conditionally updates reminder state without overwriting concurrent edits", async () => {
    const reminder = { notificationId: "notification", scheduledForIso: "2020-01-01T00:00:00.000Z", createdAt: "2020-01-01", updatedAt: "2020-01-01" };
    for (let index = 0; index < 30; index += 1) {
      const row = raw(`reminder-${String(index).padStart(2, "0")}`);
      row.payload = JSON.stringify({ values: JSON.parse(row.payload), reminderState: { splitReminder: reminder, participantDebtReminders: {} }, preserved: "metadata" });
      await seed(row);
    }
    await seed(raw("without-reminder"));
    const first = await records.listReminderRecordCandidates(undefined, 25);
    const second = await records.listReminderRecordCandidates(first.nextCursor!, 25);
    expect(first.records).toHaveLength(25);
    expect(second.records).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const candidate = first.records[0];
    const concurrentlyEdited = JSON.parse(candidate.rawPayload);
    concurrentlyEdited.values.splitName = "Changed while reconciling";
    const currentPayload = JSON.stringify(concurrentlyEdited);
    await database.runAsync("UPDATE split_records SET payload = ? WHERE id = ?", [currentPayload, candidate.record.id]);
    const cleared = { participantDebtReminders: {} };
    expect(await records.replaceReminderStateIfUnchanged(candidate.record.id, candidate.rawPayload, cleared)).toBe(false);
    expect((await records.getRecordById(candidate.record.id))?.reminderState?.splitReminder?.notificationId).toBe("notification");
    expect(await records.replaceReminderStateIfUnchanged(candidate.record.id, currentPayload, cleared)).toBe(true);
    const stored = await database.getFirstAsync("SELECT payload FROM split_records WHERE id = ?", [candidate.record.id]);
    expect(JSON.parse(stored.payload)).toMatchObject({ values: { splitName: "Changed while reconciling" }, reminderState: cleared, preserved: "metadata" });
    const reconcile = jest.fn(async () => cleared);
    expect(await records.reconcileReminderCandidate(candidate, () => true, reconcile)).toEqual({ status: "stale" });
    expect(reconcile).not.toHaveBeenCalled();
    const nextCandidate = first.records[1];
    expect(await records.reconcileReminderCandidate(nextCandidate, () => false, reconcile)).toEqual({ status: "skipped" });
    expect(reconcile).not.toHaveBeenCalled();
    await expect(records.reconcileReminderCandidate(nextCandidate, () => true, async () => { throw new Error("notification failure"); })).rejects.toThrow("notification failure");
    expect((await records.getRecordById(nextCandidate.record.id))?.reminderState?.splitReminder?.notificationId).toBe("notification");
    expect(await records.reconcileReminderCandidate(nextCandidate, () => true, reconcile)).toEqual({ status: "updated", reminderState: cleared });
  });

  it("reconciles reminders in unloaded history and retries after notification failure", async () => {
    const makeReminder = (id: string, date: string) => ({ notificationId: id, scheduledForIso: date, createdAt: "2020-01-01", updatedAt: "2020-01-01" });
    const expired = raw("expired");
    expired.payload = JSON.stringify({ values: JSON.parse(expired.payload), reminderState: { splitReminder: makeReminder("expired-notice", "2020-01-01T00:00:00.000Z"), participantDebtReminders: {} } });
    const missing = raw("missing-participant");
    missing.payload = JSON.stringify({ values: JSON.parse(missing.payload), reminderState: { participantDebtReminders: { missing: makeReminder("missing-notice", "2999-01-01T00:00:00.000Z") } } });
    const future = raw("future");
    future.payload = JSON.stringify({ values: JSON.parse(future.payload), reminderState: { splitReminder: makeReminder("future-notice", "2999-01-01T00:00:00.000Z"), participantDebtReminders: {} } });
    await seed(expired);
    await seed(missing);
    await seed(future);
    await migration.migratePersonIdentity();
    const store = await loadPersistedStore();
    store.setState({ records: [], activeRecordId: null });
    const cancel = require("expo-notifications").cancelScheduledNotificationAsync as jest.Mock;
    cancel.mockReset().mockRejectedValueOnce(new Error("notification unavailable")).mockResolvedValue(undefined);
    await expect(store.getState().reconcileReminders()).rejects.toThrow("notification unavailable");
    expect((await records.getRecordById("expired"))?.reminderState?.splitReminder?.notificationId).toBe("expired-notice");
    await store.getState().reconcileReminders();
    expect((await records.getRecordById("expired"))?.reminderState).toEqual({ participantDebtReminders: {} });
    expect((await records.getRecordById("missing-participant"))?.reminderState).toEqual({ participantDebtReminders: {} });
    expect((await records.getRecordById("future"))?.reminderState?.splitReminder?.notificationId).toBe("future-notice");
    expect(cancel).toHaveBeenCalledWith("expired-notice");
    expect(cancel).toHaveBeenCalledWith("missing-notice");
  });

  it("reflects edits and deletion in indexed list results", async () => {
    const { listSplitSummaries } = require("./splitList") as typeof import("./splitList");
    await seed();
    await migration.migratePersonIdentity();
    const [record] = await records.listRecords();
    await records.saveRecord({ ...record, values: { ...record.values, splitName: "Updated dinner", splitDate: "2026-03-05", tagIds: ["food"] } });
    const updated = await listSplitSummaries({ limit: 20, tagIds: ["food"] });
    expect(updated.records).toEqual([expect.objectContaining({ id: record.id, splitName: "Updated dinner", splitDate: "2026-03-05" })]);
    await records.deleteRecord(record.id);
    expect((await listSplitSummaries({ limit: 20, tagIds: ["food"] })).records).toEqual([]);
  });

  it("removes a tag from unloaded splits atomically across batches and retries a failed write", async () => {
    for (let index = 0; index < 105; index += 1) {
      const row = raw(`tagged-${String(index).padStart(3, "0")}`);
      const values = JSON.parse(row.payload);
      values.tagIds = ["  remove  ", "keep"];
      row.payload = JSON.stringify(index % 2 ? { values, extraWrapper: "preserved" } : values);
      await seed(row);
    }
    await migration.migratePersonIdentity();
    const settingsModule = require("./settings") as typeof import("./settings");
    const original = { ...await settingsModule.getAppSettings(), tags: [
      { id: "remove", label: "Remove", icon: null, color: "orange" as const },
      { id: "keep", label: "Keep", icon: null, color: "mint" as const },
    ] };
    await settingsModule.saveAppSettings(original);
    const { countSplitTagUsage } = require("./splitList") as typeof import("./splitList");
    expect(await countSplitTagUsage("remove")).toBe(105);
    expect(await countSplitTagUsage("remove", ["tagged-000", "tagged-001"])).toBe(103);
    expect(await countSplitTagUsage("missing")).toBe(0);
    const nextSettings = { ...original, tags: original.tags.filter((tag) => tag.id !== "remove") };
    failSql = "UPDATE split_records SET payload";
    await expect(records.removeSplitTagAndUpdateSettings("remove", nextSettings)).rejects.toThrow("injected");
    expect((await settingsModule.getAppSettings()).tags?.map((tag) => tag.id)).toEqual(["remove", "keep"]);
    expect((await records.getRecordById("tagged-000"))?.values.tagIds).toEqual(["remove", "keep"]);
    failSql = null;
    await records.removeSplitTagAndUpdateSettings("remove", nextSettings);
    expect((await settingsModule.getAppSettings()).tags?.map((tag) => tag.id)).toEqual(["keep"]);
    const stored = await records.listRecords();
    expect(stored).toHaveLength(105);
    expect(stored.every((record) => JSON.stringify(record.values.tagIds) === JSON.stringify(["keep"]))).toBe(true);
    const rawWrapped = await database.getFirstAsync("SELECT payload FROM split_records WHERE id = ?", ["tagged-001"]);
    expect(JSON.parse(rawWrapped.payload).extraWrapper).toBe("preserved");
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

  it("saves item edits without rewriting unchanged participant memberships", async () => {
    await seed();
    await migration.migratePersonIdentity();
    const [record] = await records.listRecords();
    const writes: string[] = [];
    beforeRun = async (sql) => { writes.push(sql); };
    const saved = await records.saveRecord({ ...record, values: { ...record.values, splitName: "Updated" } });
    expect(saved.record.values.splitName).toBe("Updated");
    expect(writes.filter((sql) => /(?:DELETE FROM|INSERT INTO) split_person_memberships/.test(sql))).toHaveLength(0);
    await memberships.verifyPersonMemberships(database);
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
      "INSERT INTO split_records (id, status, step, payload, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      Object.values(raw("legacy", "Legacy participant")),
    );
    expect(await memberships.listLegacyRecordIdsForPerson("  LEGACY   participant ", "You")).toEqual(["legacy"]);
    expect(await memberships.listLegacyRecordIdsForPerson("You", "You")).toEqual([]);
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
    const groupOnlyResult = await deleteSavedPerson("group-only-person");
    expect(groupOnlyResult.result).toBe("archived");
    expect(groupOnlyResult.settings.participantGroups.find((group: any) => group.id === "group-only").memberPersonIds).toEqual([]);
    const persisted = await require("./settings").getAppSettings();
    expect(persisted.participantGroups.find((group: any) => group.id === "group-only").memberPersonIds).toEqual([]);
    expect(await records.getRecordById("legacy")).toBeTruthy();
  });

  it("finds name-only legacy references across bounded batches without loading split payloads", async () => {
    for (let index = 0; index < 105; index += 1) {
      const row = raw(`legacy-${String(index).padStart(3, "0")}`, index % 2 ? "Other" : "  Ana  ");
      await seed(row);
    }
    const readSpy = jest.spyOn(database, "getAllAsync");
    const ids = await memberships.listLegacyRecordIdsForPerson("Ana", "You");
    expect(ids).toHaveLength(53);
    expect(ids[0]).toBe("legacy-000");
    expect(ids[52]).toBe("legacy-104");
    expect(readSpy.mock.calls.filter((call) => String(call[0]).includes("AS participants"))).toHaveLength(2);
  });

  it("finds participant name conflicts beyond the first batch and respects the edited identity", async () => {
    for (let index = 0; index < 101; index += 1) await seed(raw(`a-${String(index).padStart(3, "0")}`, "Other"));
    const linked = raw("z-linked", "Ána Silva");
    const linkedValues = JSON.parse(linked.payload);
    linkedValues.participants[0].personId = "edited";
    linkedValues.splitName = "Linked split";
    linked.payload = JSON.stringify({ values: linkedValues });
    await seed(linked);
    const old = raw("z-legacy", " áNA   SILVA ");
    const oldValues = JSON.parse(old.payload);
    oldValues.splitName = "Old dinner";
    old.payload = JSON.stringify(oldValues);
    await seed(old);
    expect(await memberships.listPersonNameConflicts("Ána Silva", "edited")).toEqual([{ id: "z-legacy", splitName: "Old dinner" }]);
    expect((await memberships.listPersonNameConflicts("Ána Silva", null)).map((entry) => entry.id)).toEqual(["z-legacy", "z-linked"]);
  });
});
