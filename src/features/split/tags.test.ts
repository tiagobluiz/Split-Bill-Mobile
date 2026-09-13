import {
  DEFAULT_SPLIT_TAGS,
  createCustomTag,
  createCustomTagIcon,
  getSplitTagDisplayLabel,
  getSplitTagLabelKey,
  isDefaultSplitTag,
  normalizeCustomTagIcon,
  normalizeTagIds,
  normalizeTagName,
  normalizeTags,
  sortTagsAlphabetically,
} from "./tags";

describe("split tags", () => {
  it("normalizes custom icon and tag names", () => {
    expect(normalizeCustomTagIcon("  🇪🇸 Spain  ")).toBe("🇪🇸");
    expect(normalizeCustomTagIcon("   ")).toBe("");
    expect(createCustomTagIcon(" 🧾 ")).toBe("custom:🧾");
    expect(createCustomTagIcon("   ")).toBeNull();
    expect(normalizeTagName("  123456789012345678901234567890  ")).toBe(
      "123456789012345678901234",
    );
  });

  it("normalizes persisted tags and keeps default metadata when missing", () => {
    expect(normalizeTags(undefined)).toBe(DEFAULT_SPLIT_TAGS);
    expect(normalizeTags([])).toEqual([]);
    expect(
      normalizeTags([
        null,
        "bad",
        { id: "", label: "No id" },
        { id: "blank", label: "   " },
        { id: "tag-groceries", label: "Groceries" },
        {
          id: "custom",
          label: "  Travel  ",
          icon: "custom:🇵🇹",
          color: "#AA00CC",
        },
        { id: "duplicate", label: "travel" },
        { id: "unknown-icon", label: "Unknown", icon: "bogus", color: "bogus" },
        {
          id: "explicit-built-in",
          label: "Built",
          icon: null,
          color: "mint",
          builtIn: true,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: "tag-groceries",
        icon: "cart",
        color: "mint",
      }),
      expect.objectContaining({
        id: "custom",
        label: "Travel",
        icon: "custom:🇵🇹",
        color: "#aa00cc",
      }),
      expect.objectContaining({
        id: "unknown-icon",
        icon: "utensils",
        color: "orange",
      }),
      expect.objectContaining({
        id: "explicit-built-in",
        icon: null,
        color: "mint",
        builtIn: true,
      }),
    ]);
    expect(normalizeTags([{ id: "", label: "" }])).toBe(DEFAULT_SPLIT_TAGS);
  });

  it("normalizes selected tag ids against optional known tags", () => {
    expect(normalizeTagIds("bad")).toEqual([]);
    expect(normalizeTagIds([" one ", "one", "", 5])).toEqual(["one"]);
    expect(
      normalizeTagIds([" tag-groceries ", "missing"], DEFAULT_SPLIT_TAGS),
    ).toEqual(["tag-groceries"]);
  });

  it("sorts tags alphabetically without changing the source array", () => {
    const tags = [
      { id: "z", label: "Zoo", icon: null, color: "gray" },
      { id: "a", label: "activities", icon: null, color: "mint" },
      { id: "b", label: "Beach 2", icon: null, color: "orange" },
      { id: "c", label: "Beach 10", icon: null, color: "clay" },
    ] as const;

    expect(sortTagsAlphabetically([...tags]).map((tag) => tag.label)).toEqual([
      "activities",
      "Beach 2",
      "Beach 10",
      "Zoo",
    ]);
    expect(tags.map((tag) => tag.label)).toEqual([
      "Zoo",
      "activities",
      "Beach 2",
      "Beach 10",
    ]);
  });

  it("resolves built-in display labels through translation keys", () => {
    const restaurant = DEFAULT_SPLIT_TAGS.find(
      (tag) => tag.id === "tag-restaurant",
    )!;
    const custom = {
      id: "custom",
      label: "Beach",
      icon: null,
      color: "mint",
    } as const;

    expect(getSplitTagLabelKey(restaurant)).toBe("tags.defaults.restaurant");
    expect(getSplitTagDisplayLabel(restaurant, () => "Restaurante")).toBe(
      "Restaurante",
    );
    expect(getSplitTagDisplayLabel(custom, () => "Ignored")).toBe("Beach");
  });

  it("creates custom tags only when names are unique", () => {
    expect(createCustomTag("   ", [])).toBeNull();
    expect(createCustomTag(" restaurant ", DEFAULT_SPLIT_TAGS)).toBeNull();
    expect(createCustomTag(" Supermercado ", [])).toBeNull();
    expect(createCustomTag("Beach", [], null, "clay")).toEqual(
      expect.objectContaining({
        label: "Beach",
        icon: null,
        color: "clay",
      }),
    );
    expect(isDefaultSplitTag({ id: "tag-groceries" })).toBe(true);
    expect(isDefaultSplitTag({ id: "custom", builtIn: true })).toBe(true);
    expect(isDefaultSplitTag({ id: "custom" })).toBe(false);
  });
});
