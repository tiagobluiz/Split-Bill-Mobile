import { listReminderRecordCandidates, reconcileReminderCandidate, type DraftRecord } from "../../storage/records";
import { reconcileScheduledReminders } from "./reminders";
import { reconcileStoredReminders } from "./reconcileStoredReminders";

jest.mock("../../storage/records", () => ({ listReminderRecordCandidates: jest.fn(), reconcileReminderCandidate: jest.fn() }));
jest.mock("./reminders", () => ({
  ...jest.requireActual("./reminders"),
  reconcileScheduledReminders: jest.fn(),
}));

const reminder = { notificationId: "old-notice", scheduledForIso: "2020-01-01T00:00:00.000Z", createdAt: "2020-01-01", updatedAt: "2020-01-01" };
const candidate = { rawPayload: "old", record: { id: "old", values: { participants: [] }, reminderState: { splitReminder: reminder, participantDebtReminders: {} } } as unknown as DraftRecord };

describe("reconcileStoredReminders", () => {
  beforeEach(() => jest.resetAllMocks());

  it("reconciles unloaded candidates in bounded pages", async () => {
    (listReminderRecordCandidates as jest.Mock).mockResolvedValueOnce({ records: [candidate], nextCursor: "old" }).mockResolvedValueOnce({ records: [], nextCursor: null });
    (reconcileScheduledReminders as jest.Mock).mockResolvedValueOnce({ changed: true, records: [{ ...candidate.record, reminderState: { participantDebtReminders: {} } }] });
    (reconcileReminderCandidate as jest.Mock).mockImplementationOnce(async (_candidate, shouldProcess, reconcile) => {
      expect(shouldProcess()).toBe(true);
      return { status: "updated", reminderState: await reconcile(candidate.record) };
    });
    const onUpdated = jest.fn(() => true);
    const result = await reconcileStoredReminders({ isLoaded: () => false, onUpdated });
    expect(result).toEqual({ changed: true, retry: false });
    expect(onUpdated).toHaveBeenCalledWith(candidate.record, { participantDebtReminders: {} });
    expect(listReminderRecordCandidates).toHaveBeenNthCalledWith(2, "old", 25);
  });

  it("requests another pass when the candidate changed or became loaded", async () => {
    (listReminderRecordCandidates as jest.Mock).mockResolvedValue({ records: [candidate], nextCursor: null });
    (reconcileReminderCandidate as jest.Mock).mockResolvedValueOnce({ status: "stale" });
    await expect(reconcileStoredReminders({ isLoaded: () => false, onUpdated: () => true })).resolves.toEqual({ changed: false, retry: true });
    await expect(reconcileStoredReminders({ isLoaded: () => true, onUpdated: () => true })).resolves.toEqual({ changed: false, retry: true });
  });

  it("propagates notification failures for retry by the caller", async () => {
    (listReminderRecordCandidates as jest.Mock).mockResolvedValue({ records: [candidate], nextCursor: null });
    (reconcileReminderCandidate as jest.Mock).mockRejectedValueOnce(new Error("notification failure"));
    await expect(reconcileStoredReminders({ isLoaded: () => false, onUpdated: () => true })).rejects.toThrow("notification failure");
  });

  it("announces committed changes even when a later candidate fails", async () => {
    (listReminderRecordCandidates as jest.Mock).mockResolvedValue({ records: [candidate, candidate], nextCursor: null });
    (reconcileReminderCandidate as jest.Mock)
      .mockResolvedValueOnce({ status: "updated", reminderState: { participantDebtReminders: {} } })
      .mockRejectedValueOnce(new Error("notification failure"));
    const onBatchChanged = jest.fn();
    await expect(reconcileStoredReminders({ isLoaded: () => false, onUpdated: () => true, onBatchChanged })).rejects.toThrow("notification failure");
    expect(onBatchChanged).toHaveBeenCalledTimes(1);
  });
});
