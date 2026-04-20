import type { DraftRecord } from "../../storage/records";

import { deriveMaxReachableStep, resolveDraftStep } from "./splitFlow";

function createRecord(overrides: Partial<DraftRecord> = {}): DraftRecord {
  return {
    id: "draft-1",
    status: "draft",
    step: 1,
    values: {
      splitName: "Weekend groceries",
      currency: "EUR",
      payerParticipantId: "ana",
      participants: [
        { id: "ana", name: "Ana" },
        { id: "bruno", name: "Bruno" },
      ],
      items: [
        {
          id: "item-1",
          name: "Milk",
          price: "4.00",
          splitMode: "even",
          allocations: [
            { participantId: "ana", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
            { participantId: "bruno", evenIncluded: true, shares: "1", percent: "50", percentLocked: false },
          ],
        },
      ],
    },
    settlementState: {
      settledParticipantIds: [],
    },
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("splitFlow", () => {
  describe("deriveMaxReachableStep", () => {
    it("returns step 6 for completed records", () => {
      expect(deriveMaxReachableStep(createRecord({ status: "completed", step: 6 }))).toBe(6);
    });

    it("returns step 2 when participant requirements are not satisfied", () => {
      const record = createRecord({
        values: {
          ...createRecord().values,
          participants: [{ id: "ana", name: "Ana" }],
          payerParticipantId: "ana",
        },
      });

      expect(deriveMaxReachableStep(record)).toBe(2);
    });

    it("returns step 3 when participants are valid but payer is missing", () => {
      const record = createRecord({
        values: {
          ...createRecord().values,
          payerParticipantId: "",
        },
      });

      expect(deriveMaxReachableStep(record)).toBe(3);
    });

    it("returns step 4 when item requirements are not satisfied", () => {
      const record = createRecord({
        values: {
          ...createRecord().values,
          items: [],
        },
      });

      expect(deriveMaxReachableStep(record)).toBe(4);
    });

    it("returns step 5 when setup and items are valid", () => {
      expect(deriveMaxReachableStep(createRecord())).toBe(5);
    });
  });

  describe("resolveDraftStep", () => {
    it("returns requested step when it is valid and reachable", () => {
      expect(resolveDraftStep(createRecord({ step: 4 }))).toBe(4);
    });

    it("clamps invalid draft steps to a minimum of 1", () => {
      expect(resolveDraftStep(createRecord({ step: Number.NaN }))).toBe(1);
      expect(resolveDraftStep(createRecord({ step: -2 }))).toBe(1);
    });

    it("clamps draft step to maximum draft step 5", () => {
      expect(resolveDraftStep(createRecord({ step: 6 }))).toBe(5);
    });

    it("never goes beyond max reachable step for drafts", () => {
      const record = createRecord({
        step: 5,
        values: {
          ...createRecord().values,
          payerParticipantId: "",
        },
      });

      expect(resolveDraftStep(record)).toBe(3);
    });

    it("returns max reachable step for completed records", () => {
      expect(resolveDraftStep(createRecord({ status: "completed", step: 1 }))).toBe(6);
    });
  });
});
