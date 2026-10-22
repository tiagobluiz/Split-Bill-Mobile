import { computeSettlement } from "../domain";
import {
  assertIdentityOnlyChange,
  planPersonIdentity,
  type RawSplitRow,
} from "./personIdentity";

const timestamp = "2026-01-01T00:00:00.000Z";
const person = (id: string, name: string, extra = {}) => ({
  id,
  name,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...extra,
});
function row(id: string, participants: any[], wrapped = true): RawSplitRow {
  const values = {
    currency: "EUR",
    payerParticipantId: participants[0]?.id ?? "",
    participants,
    items: [
      {
        id: "pizza",
        name: "Pizza",
        price: "12.00",
        splitMode: "even",
        allocations: participants.map((entry) => ({
          participantId: entry.id,
          evenIncluded: true,
          shares: "1",
          percent: "0",
        })),
      },
    ],
    extra: { preserve: true },
  };
  return {
    id,
    status: "completed",
    step: 6,
    payload: JSON.stringify(
      wrapped
        ? {
            values,
            settlementState: { settledParticipantIds: [participants[1]?.id] },
            reminderState: { participantDebtReminders: {} },
            unknown: 42,
          }
        : values,
    ),
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: timestamp,
  };
}
function plan(settings: any, rows: RawSplitRow[]) {
  let counter = 0;
  return planPersonIdentity(
    settings,
    rows,
    () => `global-${++counter}`,
    timestamp,
  );
}

describe("person identity migration planner", () => {
  it("links equal normalized names across formats and preserves every financial field", () => {
    const rows = [
      row("dinner", [
        { id: "a", name: "  Ana   Silva " },
        { id: "me", name: "You" },
      ]),
      row(
        "holiday",
        [
          { id: "ana-local", name: "ANA SILVA" },
          { id: "my-local", name: "Tiago" },
        ],
        false,
      ),
    ];
    const before = JSON.stringify(rows);
    const result = plan({ ownerName: "Tiago", unrelated: "keep" }, rows);
    expect(result.settings.people).toHaveLength(2);
    expect(result.memberships[0].personId).toBe(result.memberships[2].personId);
    expect(result.memberships[1].personId).toBe(result.settings.ownerPersonId);
    expect(result.memberships[3].personId).toBe(result.settings.ownerPersonId);
    assertIdentityOnlyChange(rows, result.rows);
    result.rows.forEach((entry) => {
      const original = JSON.parse(
        rows.find((originalRow) => originalRow.id === entry.id)!.payload,
      );
      const updated = JSON.parse(entry.payload);
      expect(computeSettlement(updated.values ?? updated)).toEqual(
        computeSettlement(original.values ?? original),
      );
    });
    expect(JSON.stringify(rows)).toBe(before);
    expect(result.settings.unrelated).toBe("keep");
  });

  it("preserves saved and archived identity and appearance, even after a previous rename", () => {
    const saved = person("ana", "Ana Maria", {
      archivedAt: timestamp,
      color: "mint",
      photoUri: "file:///saved.jpg",
    });
    const result = plan({ people: [saved] }, [
      row("s", [{ id: "local", name: "Ana", personId: "ana" }]),
    ]);
    expect(result.settings.people.find((entry) => entry.id === "ana")).toEqual(
      saved,
    );
    expect(result.memberships[0].personId).toBe("ana");
  });

  it("does not strip accents, fuzzy-match names, or truncate legacy names", () => {
    const result = plan({}, [
      row(
        "s",
        ["João", "Joao", "A".repeat(26), `${"A".repeat(25)}B`].map(
          (name, index) => ({ id: `${index}`, name }),
        ),
      ),
    ]);
    expect(
      new Set(result.memberships.map((entry) => entry.personId)).size,
    ).toBe(4);
    expect(
      result.settings.people.some((entry) => entry.name.length === 26),
    ).toBe(true);
  });

  it("recovers a consistent dangling ID before matching name-only rows", () => {
    const result = plan({}, [
      row("a", [{ id: "one", name: "Ana" }]),
      row("b", [{ id: "two", name: "ANA", personId: "lost" }]),
    ]);
    expect(result.memberships.map((entry) => entry.personId)).toEqual([
      "lost",
      "lost",
    ]);
  });

  it("rejects malformed payloads, conflicting identities, and duplicate split membership", () => {
    expect(() => plan({}, [{ ...row("s", []), payload: "broken" }])).toThrow();
    expect(() =>
      plan({ people: [person("a", "Ana"), person("b", " ANA ")] }, []),
    ).toThrow("Conflicting");
    expect(() =>
      plan({}, [
        row("s", [
          { id: "1", name: "Ana" },
          { id: "2", name: " ana " },
        ]),
      ]),
    ).toThrow("more than once");
    expect(() =>
      plan({ people: [person("a", "Ana")] }, [
        row("s", [{ id: "1", name: "Ana", personId: "orphan" }]),
      ]),
    ).toThrow("Dangling");
  });

  it("is idempotent and detects any financial or existing identity changes", () => {
    const first = plan({}, [row("s", [{ id: "a", name: "Ana" }])]);
    expect(plan(first.settings, first.rows)).toEqual(first);
    const changed = first.rows.map((entry) => ({
      ...entry,
      updated_at: "changed",
    }));
    expect(() => assertIdentityOnlyChange(first.rows, changed)).toThrow(
      "non-identity",
    );
  });
});
