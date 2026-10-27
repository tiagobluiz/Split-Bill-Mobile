import { normalizePersonNameInput, PERSON_NAME_MAX_LENGTH, validatePersonName } from "./personNames";

describe("shared person-name validation", () => {
  it.each(["", "   ", "\n\t"])("requires a nonblank name: %j", (name) => {
    expect(validatePersonName(name)).toEqual({ reason: "required" });
  });

  it("accepts the exact limit and rejects longer names instead of truncating them", () => {
    expect(validatePersonName("A".repeat(PERSON_NAME_MAX_LENGTH))).toBeNull();
    expect(validatePersonName("A".repeat(PERSON_NAME_MAX_LENGTH + 1))).toEqual({ reason: "max", max: PERSON_NAME_MAX_LENGTH });
  });

  it("normalizes whitespace before applying length and duplicate rules", () => {
    expect(normalizePersonNameInput("  Alexandra   Catherine\tSmith  ")).toBe("Alexandra Catherine Smith");
    expect(validatePersonName("  Alexandra   Catherine\tSmith  ")).toBeNull();
    const person = { id: "ana", name: " Ana   Silva " };
    expect(validatePersonName("ana\tSILVA", [person])).toEqual({ reason: "duplicate", person });
  });

  it("includes archived people and excludes the identity being edited", () => {
    const person = { id: "ana", name: "Ana", archivedAt: "2026-01-01" };
    expect(validatePersonName(" ANA ", [person], "other")).toEqual({ reason: "duplicate", person });
    expect(validatePersonName(" ANA ", [person], "ana")).toBeNull();
  });

  it("reserves You in all name editors while allowing existing split owner labels", () => {
    expect(validatePersonName(" yOu ")).toEqual({ reason: "reserved" });
    expect(validatePersonName("You", [], undefined, { allowOwnerPlaceholder: true })).toBeNull();
    expect(validatePersonName(" ", [], undefined, { allowOwnerPlaceholder: true })).toEqual({ reason: "required" });
  });
});
