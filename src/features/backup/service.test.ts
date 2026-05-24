import { decodeBackupSnapshot, encodeBackupSnapshot } from "./codec";
import {
  getNextManualQuota,
  parseBackupSnapshot,
  shouldRunScheduledBackup,
} from "./service";
import type { BackupDataPayload } from "./types";
import type { AppSettings } from "../../storage/settings";

function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ownerName: "You",
    ownerProfileImageUri: "",
    balanceFeatureEnabled: true,
    trackPaymentsFeatureEnabled: true,
    defaultCurrency: "EUR",
    language: "en",
    humour: "plain",
    splitListAmountDisplay: "remaining",
    backup: {
      enabled: true,
      frequency: "daily",
      encryptionEnabled: false,
      manualQuota: {
        dayKey: "",
        used: 0,
      },
      googleDrive: {
        connected: false,
      },
    },
    customCurrencies: [],
    ...overrides,
  };
}

function createPayload(overrides: Partial<BackupDataPayload> = {}): BackupDataPayload {
  return {
    settings: createSettings(),
    records: [],
    ...overrides,
  };
}

describe("backup service", () => {
  it("encodes and decodes plain snapshots", () => {
    const snapshot = encodeBackupSnapshot(createPayload(), {
      createdAt: "2026-05-23T10:00:00.000Z",
      appVersion: "1.0.0",
      deviceLocale: "en-US",
    });

    const decoded = decodeBackupSnapshot(snapshot);
    expect(decoded).toEqual(createPayload());
  });

  it("encodes and decodes encrypted snapshots and rejects wrong passphrases", () => {
    const snapshot = encodeBackupSnapshot(createPayload(), {
      createdAt: "2026-05-23T10:00:00.000Z",
      appVersion: "1.0.0",
      deviceLocale: "en-US",
      passphrase: "correct horse battery staple",
    });

    expect(snapshot.encryption.enabled).toBe(true);
    expect(
      decodeBackupSnapshot(snapshot, "correct horse battery staple"),
    ).toEqual(createPayload());
    expect(() => decodeBackupSnapshot(snapshot, "wrong")).toThrow(
      "invalid-backup-passphrase",
    );
  });

  it("parses snapshot envelopes and validates format", () => {
    const payload = createPayload();
    const snapshot = encodeBackupSnapshot(payload, {
      createdAt: "2026-05-23T10:00:00.000Z",
      appVersion: "1.0.0",
      deviceLocale: "en-US",
      passphrase: "abc12345",
    });
    const parsed = parseBackupSnapshot(JSON.stringify(snapshot), "abc12345");
    expect(parsed.data).toEqual(payload);
    expect(() => parseBackupSnapshot("{broken-json}")).toThrow(
      "invalid-backup-file",
    );
  });

  it("enforces manual backup quota with daily reset", () => {
    const now = new Date("2026-05-23T10:00:00.000Z");
    const settings = createSettings({
      backup: {
        enabled: true,
        frequency: "daily",
        encryptionEnabled: false,
        manualQuota: {
          dayKey: "2026-05-23",
          used: 3,
        },
        googleDrive: {
          connected: false,
        },
      },
    });

    expect(getNextManualQuota(settings, now)).toEqual({
      allowed: false,
      dayKey: "2026-05-23",
      used: 3,
      nextUsed: 3,
    });

    expect(
      getNextManualQuota(settings, new Date("2026-05-24T08:00:00.000Z")),
    ).toEqual({
      allowed: true,
      dayKey: "2026-05-24",
      used: 0,
      nextUsed: 1,
    });
  });

  it("checks schedule due logic for each frequency", () => {
    const now = new Date("2026-05-23T10:00:00.000Z");
    const daily = createSettings({
      backup: {
        enabled: true,
        frequency: "daily",
        encryptionEnabled: false,
        lastAutoBackupAt: "2026-05-23T09:00:00.000Z",
        manualQuota: { dayKey: "", used: 0 },
        googleDrive: { connected: false },
      },
    });
    expect(shouldRunScheduledBackup(daily, now)).toBe(false);

    const weekly = createSettings({
      backup: {
        enabled: true,
        frequency: "weekly",
        encryptionEnabled: false,
        lastAutoBackupAt: "2026-05-10T09:00:00.000Z",
        manualQuota: { dayKey: "", used: 0 },
        googleDrive: { connected: false },
      },
    });
    expect(shouldRunScheduledBackup(weekly, now)).toBe(true);

    const monthly = createSettings({
      backup: {
        enabled: true,
        frequency: "monthly",
        encryptionEnabled: false,
        lastAutoBackupAt: "2026-05-01T09:00:00.000Z",
        manualQuota: { dayKey: "", used: 0 },
        googleDrive: { connected: false },
      },
    });
    expect(shouldRunScheduledBackup(monthly, now)).toBe(false);
  });
});
