import type { DraftRecord } from "../../../../storage/records";
import { getSplitParticipantsByIds, listSplitIds } from "../../../../storage/splitList";
import { scanFrequentFriends } from "./scanFrequentFriends";

jest.mock("../../../../storage/splitList", () => ({ listSplitIds: jest.fn(), getSplitParticipantsByIds: jest.fn() }));

const record = (id: string, name: string) => ({ id, values: { participants: [{ id: `${id}-person`, name }] } } as DraftRecord);

describe("scanFrequentFriends", () => {
  beforeEach(() => jest.resetAllMocks());

  it("combines loaded and projected participants across pages", async () => {
    const cursor = { id: "second", splitDate: "2026-01-01", createdAt: "2026-01-01" };
    (listSplitIds as jest.Mock)
      .mockResolvedValueOnce({ records: [{ id: "loaded" }, { id: "second" }], nextCursor: cursor })
      .mockResolvedValueOnce({ records: [{ id: "third" }], nextCursor: null });
    (getSplitParticipantsByIds as jest.Mock).mockResolvedValueOnce([record("second", "Bruno")]).mockResolvedValueOnce([record("third", "Ana")]);
    const loaded = record("loaded", "Ana");
    const result = await scanFrequentFriends({ activeDraftId: "current", ownerName: "You", people: [], getLoadedRecord: (id) => id === loaded.id ? loaded : undefined, isCancelled: () => false });
    expect(result?.map((person) => person.name)).toEqual(["You", "Ana", "Bruno"]);
    expect(getSplitParticipantsByIds).toHaveBeenNthCalledWith(1, ["second"]);
    expect(getSplitParticipantsByIds).toHaveBeenNthCalledWith(2, ["third"]);
  });

  it("stops after cancellation while a page is loading", async () => {
    let finish!: (value: unknown) => void;
    (listSplitIds as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    let cancelled = false;
    const scan = scanFrequentFriends({ activeDraftId: "current", ownerName: "You", people: [], isCancelled: () => cancelled });
    cancelled = true;
    finish({ records: [{ id: "old" }], nextCursor: null });
    expect(await scan).toBeNull();
    expect(getSplitParticipantsByIds).not.toHaveBeenCalled();
  });

  it("propagates participant projection failures", async () => {
    (listSplitIds as jest.Mock).mockResolvedValueOnce({ records: [{ id: "old" }], nextCursor: null });
    (getSplitParticipantsByIds as jest.Mock).mockRejectedValueOnce(new Error("read failed"));
    await expect(scanFrequentFriends({ activeDraftId: "current", ownerName: "You", people: [], isCancelled: () => false })).rejects.toThrow("read failed");
  });
});
