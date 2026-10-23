import {
  getFrequentGroups,
} from "./screens/shared/participantUtils";
import {
  createGroup,
  createPerson,
  findPersonByName,
  normalizeGroups,
  normalizePeople,
} from "./people";

describe("people and groups", () => {
  it("normalizes people and groups while dropping malformed duplicates", () => {
    const people = normalizePeople([
      {
        id: "p1",
        name: " Ana ",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      { id: "p2", name: "ana" },
      { id: "", name: "Blank" },
      { id: "p3", name: "Bruno" },
    ]);

    expect(people.map((person) => person.name)).toEqual(["Ana", "Bruno"]);
    expect(
      normalizeGroups(
        [
          {
            id: "g1",
            name: " Roomies ",
            memberPersonIds: ["p1", "p3", "p3", "missing"],
            usageCount: 2,
          },
          { id: "g2", name: "Empty", memberPersonIds: ["missing"] },
          { id: "g3", name: "roomies", memberPersonIds: ["p1"] },
        ],
        people,
      ),
    ).toEqual([
      expect.objectContaining({
        id: "g1",
        name: "Roomies",
        memberPersonIds: ["p1", "p3"],
        usageCount: 2,
      }),
    ]);
  });

  it("orders frequent groups by usage before unused alphabetical groups", () => {
    const people = normalizePeople([
      { id: "p1", name: "Ana" },
      { id: "p2", name: "Bruno" },
      { id: "p3", name: "Carla", archivedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    const groups = normalizeGroups(
      [
        { id: "unused-b", name: "Zoo", memberPersonIds: ["p1"], usageCount: 0 },
        { id: "used-low", name: "Low", memberPersonIds: ["p1"], usageCount: 1 },
        { id: "used-high", name: "High", memberPersonIds: ["p2"], usageCount: 4 },
        { id: "unused-a", name: "Alpha", memberPersonIds: ["p1"], usageCount: 0 },
        { id: "archived-only", name: "Gone", memberPersonIds: ["p3"], usageCount: 9 },
      ],
      people,
    );

    expect(getFrequentGroups(groups, people).map((group) => group.id)).toEqual([
      "used-high",
      "used-low",
      "unused-a",
      "unused-b",
    ]);
  });

  it("preserves optional group identity metadata and bounds descriptions", () => {
    const people = normalizePeople([{ id: "p1", name: "Ana" }]);
    const [group] = normalizeGroups(
      [{ id: "g1", name: "Roomies", memberPersonIds: ["p1"], description: ` ${"x".repeat(340)} `, photoUri: "file:///photo.jpg", icon: "custom:🏠", color: "mint" }],
      people,
    );
    expect(group).toMatchObject({
      description: "x".repeat(300),
      photoUri: "file:///photo.jpg",
      icon: "custom:🏠",
      color: "mint",
    });
  });

  it("preserves person photos and colors while keeping older records compatible", () => {
    expect(normalizePeople([
      { id: "p1", name: "Ana", photoUri: "file:///person.jpg", color: "#12abef" },
      { id: "p2", name: "Bruno" },
    ])).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "p1", photoUri: "file:///person.jpg", color: "#12abef" }),
      expect.objectContaining({ id: "p2", name: "Bruno" }),
    ]));
  });

  it("rejects malformed people and normalizes optional metadata and generated timestamps", () => {
    const normalized = normalizePeople([
      null,
      [],
      { id: 5, name: "Invalid ID" },
      { id: "missing-name" },
      { id: "p1", name: " Ana ", photoUri: "  ", color: 4, archivedAt: "  " },
      { id: "p2", name: "Bruno", createdAt: "  ", updatedAt: "  " },
    ]);
    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toMatchObject({ id: "p1", name: "Ana" });
    expect(normalized[0]).not.toHaveProperty("photoUri");
    expect(normalized[0]).not.toHaveProperty("color");
    expect(normalized[0]).not.toHaveProperty("archivedAt");
    expect(normalized[1].createdAt).toBeTruthy();
    expect(normalized[1].updatedAt).toBe(normalized[1].createdAt);
    expect(normalizeGroups(null)).toEqual([]);
  });

  it("drops malformed groups and normalizes empty optional fields and invalid usage", () => {
    const people = normalizePeople([{ id: "p1", name: "Ana" }]);
    const groups = normalizeGroups([
      null,
      { id: 4, name: "Invalid" },
      { id: "missing-name" },
      { id: "no-members", name: "No members" },
      { id: "g1", name: "Roomies", memberPersonIds: ["p1"], description: "   ", photoUri: " ", createdAt: "", updatedAt: "", usageCount: Number.NaN },
    ], people);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: "g1", name: "Roomies", memberPersonIds: ["p1"], usageCount: 0 });
    expect(groups[0].createdAt).toBeTruthy();
    expect(groups[0].updatedAt).toBe(groups[0].createdAt);
    expect(groups[0].description).toBeUndefined();
    expect(groups[0]).not.toHaveProperty("photoUri");
  });

  it("creates normalized identities only for meaningful names and supports exact name lookup", () => {
    const ana = createPerson("  Ana   Silva ");
    expect(ana).toMatchObject({ name: "Ana Silva" });
    expect(ana?.id).toBeTruthy();
    expect(ana?.updatedAt).toBe(ana?.createdAt);
    expect(createPerson("   ")).toBeNull();
    expect(createGroup(" ", ["p1"])).toBeNull();
    expect(createGroup("Roomies", [" ", "p1", "p1"])).toMatchObject({ name: "Roomies", memberPersonIds: ["p1"] });
    expect(findPersonByName([ana!], "  ANA SILVA ")).toBe(ana);
    expect(findPersonByName([ana!], " ")).toBeUndefined();
  });
});
