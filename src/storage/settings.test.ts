describe("settings storage", () => {
  async function loadModule(options?: {
    row?: any | null;
  }) {
    jest.resetModules();

    const database = {
      execAsync: jest.fn(async () => undefined),
      getFirstAsync: jest.fn(async () => options?.row ?? null),
      runAsync: jest.fn(async () => undefined),
    };

    const openDatabaseAsync = jest.fn(async () => database);

    jest.doMock("expo-sqlite", () => ({
      openDatabaseAsync,
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
        ownerName: "Tiago",
        ownerProfileImageUri: "file:///profile.png",
        balanceFeatureEnabled: false,
        defaultCurrency: "USD",
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
      customCurrencies: [{ code: "TOK", name: "Tokens", symbol: "T" }],
    });

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(database.execAsync).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS app_settings"));
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      "SELECT key, payload FROM app_settings WHERE key = ?",
      ["app-settings"]
    );
    expect(loaded).toEqual({
      ownerName: "Tiago",
      ownerProfileImageUri: "file:///profile.png",
      balanceFeatureEnabled: false,
      defaultCurrency: "USD",
      customCurrencies: [{ code: "PTS", name: "Points", symbol: "pts" }],
    });
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO app_settings"),
      [
        "app-settings",
        JSON.stringify({
          ownerName: "Ana",
          ownerProfileImageUri: "file:///ana.png",
          balanceFeatureEnabled: true,
          defaultCurrency: "EUR",
          customCurrencies: [{ code: "TOK", name: "Tokens", symbol: "T" }],
        }),
      ]
    );
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
          customCurrencies: [{ code: "", name: " ", symbol: "" }],
        }),
      },
    });

    await settingsModule.initializeSettingsStorage();
    await expect(settingsModule.getAppSettings()).resolves.toEqual({
      ownerName: "You",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    });

    const missing = await loadModule({ row: null });
    await missing.settingsModule.initializeSettingsStorage();
    await expect(missing.settingsModule.getAppSettings()).resolves.toEqual({
      ownerName: "You",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
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
          customCurrencies: "wrong-shape",
        }),
      },
    });

    await settingsModule.initializeSettingsStorage();
    await expect(settingsModule.getAppSettings()).resolves.toEqual({
      ownerName: "Tiago",
      ownerProfileImageUri: "file:///profile.png",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    });
  });

  it("falls back to defaults when the stored payload is not valid JSON", async () => {
    const { settingsModule } = await loadModule({
      row: {
        key: "app-settings",
        payload: "{broken",
      },
    });

    await settingsModule.initializeSettingsStorage();
    await expect(settingsModule.getAppSettings()).resolves.toEqual({
      ownerName: "You",
      ownerProfileImageUri: "",
      balanceFeatureEnabled: true,
      defaultCurrency: "EUR",
      customCurrencies: [],
    });
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
});
