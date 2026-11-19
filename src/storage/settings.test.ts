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
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: defaultLanguage, splitListAmountDisplay: "userPaid",
      customCurrencies: [{ code: "TOK", name: "Tokens", symbol: "T" }],
    });

    expect(openDatabaseAsync).toHaveBeenCalledTimes(3);
    expect(database.execAsync).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS app_settings"));
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      "SELECT key, payload FROM app_settings WHERE key = ?",
      ["app-settings"]
    );
    expect(loaded).toMatchObject({
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
          balanceFeatureEnabled: true,
          defaultCurrency: "EUR",
          language: "en", humour: "sassy", splitListAmountDisplay: "userPaid",
          customCurrencies: [{ code: "TOK", name: "Tokens", symbol: "T" }],
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

  it("merges a preference patch into the latest settings without reading directory tables", async () => {
    const current = { defaultCurrency: "USD", language: "pt", customValue: "preserved" };
    const { database, settingsModule } = await loadModule({ row: { key: "app-settings", payload: JSON.stringify(current) } });
    await settingsModule.saveAppSettings({ defaultCurrency: "GBP" });
    expect(database.getAllAsync).not.toHaveBeenCalled();
    expect(database.runAsync).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO app_settings"),
      ["app-settings", JSON.stringify({ ...current, defaultCurrency: "GBP" })]);
  });

  it("preserves an explicitly empty saved tag list", async () => {
    const { database, settingsModule } = await loadModule({
      row: {
        key: "app-settings",
        payload: JSON.stringify({


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

      pdfDownloadDirectoryUri: "file:///downloads",
    });

    await settingsModule.saveAppSettings({


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


          balanceFeatureEnabled: "wrong",
          defaultCurrency: "",
          splitListAmountDisplay: "wrong",
          customCurrencies: [{ code: "", name: " ", symbol: "" }],
        }),
      },
    });

    await settingsModule.initializeSettingsStorage();
    await expect(settingsModule.getAppSettings()).resolves.toMatchObject({


      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      language: defaultLanguage, splitListAmountDisplay: "remaining",
      customCurrencies: [],
    });

    const missing = await loadModule({ row: null });
    await missing.settingsModule.initializeSettingsStorage();
    await expect(missing.settingsModule.getAppSettings()).resolves.toMatchObject({


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


          balanceFeatureEnabled: true,
          defaultCurrency: "eur",
          language: "pt", splitListAmountDisplay: "totalAndRemaining",
          customCurrencies: "wrong-shape",
        }),
      },
    });

    await settingsModule.initializeSettingsStorage();
    await expect(settingsModule.getAppSettings()).resolves.toMatchObject({


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
