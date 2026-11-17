describe("settings storage", () => {
  const defaultLanguage = "en";

  async function loadModule(options?: {
    row?: any | null;
    locale?: string;
    references?: Array<{ person_id: string }>;
  }) {
    jest.resetModules();

    const database = {
      execAsync: jest.fn(async () => undefined),
      getAllAsync: jest.fn(async () => options?.references ?? []),
      getFirstAsync: jest.fn(async () => options?.row ?? null),
      runAsync: jest.fn(async () => undefined),
      closeAsync: jest.fn(async () => undefined),
      withExclusiveTransactionAsync: jest.fn(async (operation: any): Promise<any> => operation(database)),
    };

    const openDatabaseAsync = jest.fn(async () => database);

    jest.doMock("expo-sqlite", () => ({
      openDatabaseAsync,
    }));
    jest.doMock("../lib/device", () => ({
      getDeviceLocale: () => options?.locale ?? "en-US",
    }));

    let settingsModule: typeof import("./settings");
    jest.isolateModules(() => {
      settingsModule = require("./settings");
    });

    return {
      database,
      openDatabaseAsync,
      settingsModule: settingsModule!,
    };
  }

  it("initializes, loads defaults, loads saved settings, and saves settings", async () => {
    const savedRow = {
      key: "app-settings",
      payload: JSON.stringify({
        ownerName: " Tiago ",
        ownerProfileImageUri: "file:///profile.png",
        balanceFeatureEnabled: false,
        defaultCurrency: "USD",
        language: "pt",
        humour: "sassy",
        splitListAmountDisplay: "total",
        customCurrencies: [{ code: "PTS", name: "Points", symbol: "pts" }],
      }),
    };

    const { database, openDatabaseAsync, settingsModule } = await loadModule({
      row: savedRow,
    });

    await settingsModule.initializeSettingsStorage();
    const loaded = await settingsModule.getAppSettings();
    await settingsModule.saveAppSettings({
      ownerName: "Ana",
      ownerProfileImageUri: "file:///ana.png",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: defaultLanguage, splitListAmountDisplay: "userPaid",
      customCurrencies: [{ code: "TOK", name: "Tokens", symbol: "T" }],
    });

    expect(openDatabaseAsync).toHaveBeenCalledTimes(4);
    expect(database.execAsync).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS app_settings"));
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      "SELECT key, payload FROM app_settings WHERE key = ?",
      ["app-settings"]
    );
    expect(loaded).toMatchObject({
      ownerName: "Tiago",
      profileSetupCompleted: true,
      ownerProfileImageUri: "file:///profile.png",
      balanceFeatureEnabled: false,
      defaultCurrency: "USD",
      language: "pt",
      splitListAmountDisplay: "total",
      customCurrencies: [{ code: "PTS", name: "Points", symbol: "pts" }],
    });
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO app_settings"),
      [
        "app-settings",
        JSON.stringify({
          ownerName: "Ana",
          ownerProfileImageUri: "file:///ana.png",
          balanceFeatureEnabled: true,
          defaultCurrency: "EUR",
          language: "en", splitListAmountDisplay: "userPaid",
          customCurrencies: [{ code: "TOK", name: "Tokens", symbol: "T" }],
          profileSetupCompleted: true,
        }),
      ]
    );
  });

  it.each(["sassy", "unhinged"])("removes legacy %s tone without changing other settings", async (humour) => {
    const original = { ownerName: "You", profileSetupCompleted: false, language: "pt", humour, customValue: "preserved" };
    const row = { key: "app-settings", payload: JSON.stringify(original) };
    const { database, settingsModule } = await loadModule({ row });
    const loaded = await settingsModule.getAppSettings();
    expect(loaded.language).toBe("pt");
    expect(loaded).not.toHaveProperty("humour");
    expect(database.runAsync).toHaveBeenCalledWith("UPDATE app_settings SET payload = ? WHERE key = ?", [JSON.stringify({ ownerName: "You", profileSetupCompleted: false, language: "pt", customValue: "preserved" }), "app-settings"]);
  });

  it("continues with plain copy if legacy tone cleanup fails", async () => {
    const row = { key: "app-settings", payload: JSON.stringify({ ownerName: "You", language: "pt", humour: "unhinged" }) };
    const { database, settingsModule } = await loadModule({ row });
    database.runAsync.mockRejectedValueOnce(new Error("write failed"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await settingsModule.getAppSettings()).toMatchObject({ language: "pt" });
    expect(database.runAsync).toHaveBeenCalled();
    await settingsModule.getAppSettings();
    expect(database.runAsync).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("marks legacy custom-name profiles complete and keeps the default name eligible", async () => {
    const custom = await loadModule({ row: { key: "app-settings", payload: JSON.stringify({ ownerName: "  Ana  " }) } });
    const loadedCustom = await custom.settingsModule.getAppSettings();
    expect(loadedCustom).toMatchObject({ ownerName: "Ana", profileSetupCompleted: true });
    expect(custom.database.runAsync).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO app_settings"), expect.arrayContaining(["app-settings", expect.stringContaining('"profileSetupCompleted":true')]));

    const pending = await loadModule({ row: { key: "app-settings", payload: JSON.stringify({ ownerName: " You " }) } });
    const loadedPending = await pending.settingsModule.getAppSettings();
    expect(loadedPending).toMatchObject({ ownerName: "You", profileSetupCompleted: false });
    expect(pending.database.runAsync).not.toHaveBeenCalled();
  });


  it("returns inferred custom-name settings when persisting the migration fails", async () => {
    const { database, settingsModule } = await loadModule({
      row: { key: "app-settings", payload: JSON.stringify({ ownerName: "Ana" }) },
    });
    database.runAsync.mockRejectedValueOnce(new Error("disk unavailable"));
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(settingsModule.getAppSettings()).resolves.toMatchObject({
      ownerName: "Ana",
      profileSetupCompleted: true,
    });
    expect(warning).toHaveBeenCalledWith(
      "[Split Bill storage] Could not persist inferred profile setup state",
      expect.any(Error),
    );
    warning.mockRestore();
  });

  it("never clears a committed profile setup flag", async () => {
    const { database, settingsModule } = await loadModule({ row: { key: "app-settings", payload: JSON.stringify({ ownerName: "Ana", profileSetupCompleted: true }) } });
    await settingsModule.saveAppSettings({
      ownerName: "Ana", profileSetupCompleted: false, ownerProfileImageUri: "", balanceFeatureEnabled: true, defaultCurrency: "EUR", language: "en", splitListAmountDisplay: "remaining", customCurrencies: [],
    });
    const savedCall = database.runAsync.mock.calls.at(-1) as unknown as [string, [string, string]];
    expect(JSON.parse(savedCall[1][1]).profileSetupCompleted).toBe(true);
  });

  it("preserves people committed after a settings snapshot was read", async () => {
    const person = { id: "person-bruno", name: "Bruno", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" };
    const { database, settingsModule } = await loadModule({
      row: { key: "app-settings", payload: JSON.stringify({ ownerName: "You", people: [person] }) },
      references: [{ person_id: person.id }],
    });

    await settingsModule.saveAppSettings({
      ownerName: "You",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: "en", splitListAmountDisplay: "remaining",
      customCurrencies: [],
    });

    const saveArgs = database.runAsync.mock.calls.at(-1) as unknown as [string, [string, string]];
    expect(JSON.parse(saveArgs[1][1]).people).toEqual([person]);
  });

  it("does not re-archive a person from an older settings snapshot", async () => {
    const active = { id: "person-ana", name: "Ana", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-02T00:00:00.000Z" };
    const staleArchived = { ...active, archivedAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" };
    const { database, settingsModule } = await loadModule({
      row: { key: "app-settings", payload: JSON.stringify({ ownerName: "You", people: [active] }) },
    });

    await settingsModule.saveAppSettings({
      ownerName: "You", ownerProfileImageUri: "", balanceFeatureEnabled: true, defaultCurrency: "EUR", language: "en", splitListAmountDisplay: "remaining", customCurrencies: [],
      people: [staleArchived],
    });

    const saveArgs = database.runAsync.mock.calls.at(-1) as unknown as [string, [string, string]];
    expect(JSON.parse(saveArgs[1][1]).people).toEqual([active]);
  });

  it("preserves the configured owner spelling when loading and saving people", async () => {
    const owner = { id: "owner-person", name: "Alice Smith", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
    const { database, settingsModule } = await loadModule({
      row: { key: "app-settings", payload: JSON.stringify({ ownerName: "Alice  Smith", ownerPersonId: owner.id, people: [owner] }) },
    });

    const loaded = await settingsModule.getAppSettings();
    expect(loaded.people?.find((person) => person.id === owner.id)?.name).toBe("Alice  Smith");

    await settingsModule.saveAppSettings(loaded);
    const saveArgs = database.runAsync.mock.calls.at(-1) as unknown as [string, [string, string]];
    const saved = JSON.parse(saveArgs[1][1]);
    expect(saved.ownerName).toBe("Alice  Smith");
    expect(saved.people.find((person: any) => person.id === owner.id)?.name).toBe("Alice  Smith");
  });

  it("preserves an explicitly empty saved tag list", async () => {
    const { database, settingsModule } = await loadModule({
      row: {
        key: "app-settings",
        payload: JSON.stringify({
          ownerName: "Tiago",
          ownerProfileImageUri: "",
          balanceFeatureEnabled: true,
          defaultCurrency: "EUR",
          language: "en", splitListAmountDisplay: "remaining",
          customCurrencies: [],
          tags: [],
        }),
      },
    });

    await expect(settingsModule.getAppSettings()).resolves.toMatchObject({
      tags: [],
    });

    await settingsModule.saveAppSettings({
      ownerName: "Tiago",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: defaultLanguage, splitListAmountDisplay: "remaining",
      customCurrencies: [],
      tags: [],
    });

    const saveArgs = database.runAsync.mock.calls.at(-1) as unknown as [
      string,
      [string, string],
    ];
    expect(JSON.parse(saveArgs[1][1])).toMatchObject({ tags: [] });
  });

  it("loads and saves the optional PDF download directory URI", async () => {
    const { database, settingsModule } = await loadModule({
      row: {
        key: "app-settings",
        payload: JSON.stringify({
          ownerName: "Tiago",
          ownerProfileImageUri: "",
          balanceFeatureEnabled: true,
          defaultCurrency: "EUR",
          language: "en", splitListAmountDisplay: "remaining",
          customCurrencies: [],
          pdfDownloadDirectoryUri: "file:///downloads",
        }),
      },
    });

    await settingsModule.initializeSettingsStorage();
    await expect(settingsModule.getAppSettings()).resolves.toMatchObject({
      ownerName: "Tiago",
      pdfDownloadDirectoryUri: "file:///downloads",
    });

    await settingsModule.saveAppSettings({
      ownerName: "Ana",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: defaultLanguage, splitListAmountDisplay: "remaining",
      customCurrencies: [],
      pdfDownloadDirectoryUri: "file:///documents",
    });

    const saveArgs = database.runAsync.mock.calls.at(-1) as unknown as [string, [string, string]];
    const persistedPayload = JSON.parse(saveArgs[1][1]);
    expect(persistedPayload.pdfDownloadDirectoryUri).toBe("file:///documents");
  });

  it("falls back to defaults when settings do not exist or are malformed", async () => {
    const { settingsModule } = await loadModule({
      row: {
        key: "app-settings",
        payload: JSON.stringify({
          ownerName: "",
          ownerProfileImageUri: 123,
          balanceFeatureEnabled: "wrong",
          defaultCurrency: "",
          splitListAmountDisplay: "wrong",
          customCurrencies: [{ code: "", name: " ", symbol: "" }],
        }),
      },
    });

    await settingsModule.initializeSettingsStorage();
    await expect(settingsModule.getAppSettings()).resolves.toMatchObject({
      ownerName: "You",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: defaultLanguage, splitListAmountDisplay: "remaining",
      customCurrencies: [],
    });

    const missing = await loadModule({ row: null });
    await missing.settingsModule.initializeSettingsStorage();
    await expect(missing.settingsModule.getAppSettings()).resolves.toMatchObject({
      ownerName: "You",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: defaultLanguage, splitListAmountDisplay: "remaining",
      customCurrencies: [],
    });
  });

  it("falls back when custom currencies are not stored as an array", async () => {
    const { settingsModule } = await loadModule({
      row: {
        key: "app-settings",
        payload: JSON.stringify({
          ownerName: "Tiago",
          ownerProfileImageUri: "file:///profile.png",
          balanceFeatureEnabled: true,
          defaultCurrency: "eur",
          language: "pt", splitListAmountDisplay: "totalAndRemaining",
          customCurrencies: "wrong-shape",
        }),
      },
    });

    await settingsModule.initializeSettingsStorage();
    await expect(settingsModule.getAppSettings()).resolves.toMatchObject({
      ownerName: "Tiago",
      ownerProfileImageUri: "file:///profile.png",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: "pt", splitListAmountDisplay: "totalAndRemaining",
      customCurrencies: [],
    });
  });

  it("uses locale-derived translation defaults for legacy rows without language or humour", async () => {
    const { settingsModule } = await loadModule({
      locale: "pt-PT",
      row: {
        key: "app-settings",
        payload: JSON.stringify({
          ownerName: "Tiago",
          ownerProfileImageUri: "",
          balanceFeatureEnabled: true,
          defaultCurrency: "eur",
          splitListAmountDisplay: "remaining",
          customCurrencies: [],
        }),
      },
    });

    await settingsModule.initializeSettingsStorage();
    await expect(settingsModule.getAppSettings()).resolves.toMatchObject({
      language: "pt", });
  });

  it("falls back to defaults when the stored payload is not valid JSON", async () => {
    const { settingsModule } = await loadModule({
      row: {
        key: "app-settings",
        payload: "{broken",
      },
    });

    await settingsModule.initializeSettingsStorage();
    await expect(settingsModule.getAppSettings()).resolves.toMatchObject({
      ownerName: "You",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: defaultLanguage, splitListAmountDisplay: "remaining",
      customCurrencies: [],
    });
  });

  it("falls back to defaults when the stored payload parses to a non-object value", async () => {
    const objectLikePayloads = ["null", "[]", "\"hello\"", "5", "true"];

    for (const payload of objectLikePayloads) {
      const { settingsModule } = await loadModule({
        row: {
          key: "app-settings",
          payload,
        },
      });

      await settingsModule.initializeSettingsStorage();
      await expect(settingsModule.getAppSettings()).resolves.toMatchObject({
        ownerName: "You",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: defaultLanguage, splitListAmountDisplay: "remaining",
      customCurrencies: [],
      });
    }
  });

  it("retries opening the database after a previous open failure", async () => {
    jest.resetModules();
    const database = {
      execAsync: jest.fn(async () => undefined),
      getFirstAsync: jest.fn(async () => null),
      runAsync: jest.fn(async () => undefined),
    };
    const openDatabaseAsync = jest
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(database);

    jest.doMock("expo-sqlite", () => ({
      openDatabaseAsync,
    }));

    let settingsModule: typeof import("./settings");
    jest.isolateModules(() => {
      settingsModule = require("./settings");
    });

    await expect(settingsModule!.initializeSettingsStorage()).rejects.toThrow("boom");
    await expect(settingsModule!.initializeSettingsStorage()).resolves.toBeUndefined();
    expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it.each([
    [true, false, true], [false, true, false], [undefined, false, false],
    ["invalid", true, true], [undefined, undefined, true],
  ])("migrates legacy payment setting %s and balance setting %s", async (payment, balance, expected) => {
    const row = { key: "app-settings", payload: JSON.stringify({ trackPaymentsFeatureEnabled: payment, balanceFeatureEnabled: balance }) };
    const { settingsModule, database } = await loadModule({ row });
    const loaded = await settingsModule.getAppSettings();
    expect(loaded.balanceFeatureEnabled).toBe(expected);
    await settingsModule.saveAppSettings(loaded);
    const call = database.runAsync.mock.calls.at(-1) as unknown as [string, [string, string]];
    const saved = JSON.parse(call[1][1]);
    expect(saved.balanceFeatureEnabled).toBe(expected);
    expect(saved).not.toHaveProperty("trackPaymentsFeatureEnabled");
    const reloaded = await loadModule({ row: { key: "app-settings", payload: JSON.stringify(saved) } });
    expect((await reloaded.settingsModule.getAppSettings()).balanceFeatureEnabled).toBe(expected);
  });
});
