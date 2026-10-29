import type { DraftRecord } from "../../storage/records";
import { compareSplitDates } from "./splitDateOrder";

function record(id: string, day: string, createdAt: string, updatedAt: string) {
  return { id, values: { splitDate: day }, createdAt, updatedAt } as DraftRecord;
}

it("orders by split day, creation timestamp and id regardless of update timestamp", () => {
  const a = record("a", "2026-03-10", "2026-03-10T10:00:00.001Z", "2026-12-01");
  const b = record("b", "2026-03-10", "2026-03-10T10:00:00.001Z", "2026-01-01");
  const c = record("c", "2026-03-10", "2026-03-10T10:00:00.002Z", "2026-01-01");
  const d = record("d", "2026-03-11", "2026-01-01T00:00:00.000Z", "2026-01-01");
  expect([d, c, b, a].sort((l, r) => compareSplitDates(l, r, false)).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  expect([a, b, c, d].sort((l, r) => compareSplitDates(l, r, true)).map((r) => r.id)).toEqual(["d", "c", "b", "a"]);
});
