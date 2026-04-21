import { createDefaultValues } from "../../../../domain";
import type { DraftRecord } from "../../../../storage/records";

import { getRecordMoneyPreview } from "./settlementUtils";

function buildRecord(overrides?: Partial<DraftRecord>): DraftRecord {
  return {
    id: "draft-1",
    status: "draft",
    step: 1,
    values: createDefaultValues(),
    settlementState: { settledParticipantIds: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("settlementUtils", () => {
  it("uses default settlement resolver when a custom resolver is not provided", () => {
    const preview = getRecordMoneyPreview(buildRecord(), "Ana");
    expect(preview).toBeNull();
  });
});
