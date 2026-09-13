import { createId, trimName } from "../../domain";
import { translationCatalog } from "../../i18n/catalog";

export type SplitTag = {
  id: string;
  label: string;
  icon: SplitTagIcon | null;
  color: SplitTagColor;
  builtIn?: boolean;
};

export const TAG_NAME_MAX_LENGTH = 24;
export const CUSTOM_TAG_ICON_MAX_LENGTH = 16;
export type BuiltInSplitTagIcon =
  | "utensils"
  | "cart"
  | "cup"
  | "plane"
  | "home"
  | "receipt"
  | "heart"
  | "briefcase";
export type CustomSplitTagIcon = `custom:${string}`;
export type SplitTagIcon = BuiltInSplitTagIcon | CustomSplitTagIcon;
export type BuiltInSplitTagColor = "orange" | "mint" | "clay" | "gray";
export type SplitTagColor = BuiltInSplitTagColor | `#${string}`;
export type BuiltInSplitTagLabelKey =
  | "tags.defaults.restaurant"
  | "tags.defaults.groceries"
  | "tags.defaults.drinks"
  | "tags.defaults.travel"
  | "tags.defaults.rent"
  | "tags.defaults.utilities"
  | "tags.defaults.activities"
  | "tags.defaults.other";

const DEFAULT_TAG_LABEL_KEYS: Record<string, BuiltInSplitTagLabelKey> = {
  "tag-restaurant": "tags.defaults.restaurant",
  "tag-groceries": "tags.defaults.groceries",
  "tag-drinks": "tags.defaults.drinks",
  "tag-travel": "tags.defaults.travel",
  "tag-rent": "tags.defaults.rent",
  "tag-utilities": "tags.defaults.utilities",
  "tag-activities": "tags.defaults.activities",
  "tag-other": "tags.defaults.other",
};

export const DEFAULT_SPLIT_TAGS: SplitTag[] = [
  {
    id: "tag-restaurant",
    label: "Restaurant",
    icon: "utensils",
    color: "orange",
    builtIn: true,
  },
  {
    id: "tag-groceries",
    label: "Groceries",
    icon: "cart",
    color: "mint",
    builtIn: true,
  },
  {
    id: "tag-drinks",
    label: "Drinks",
    icon: "cup",
    color: "orange",
    builtIn: true,
  },
  {
    id: "tag-travel",
    label: "Travel",
    icon: "plane",
    color: "clay",
    builtIn: true,
  },
  { id: "tag-rent", label: "Rent", icon: "home", color: "gray", builtIn: true },
  {
    id: "tag-utilities",
    label: "Utilities",
    icon: "receipt",
    color: "gray",
    builtIn: true,
  },
  {
    id: "tag-activities",
    label: "Activities",
    icon: "heart",
    color: "mint",
    builtIn: true,
  },
  {
    id: "tag-other",
    label: "Other",
    icon: null,
    color: "clay",
    builtIn: true,
  },
];

const DEFAULT_TAG_BY_ID = new Map(
  DEFAULT_SPLIT_TAGS.map((tag) => [tag.id, tag]),
);

export function isDefaultSplitTag(tag: Pick<SplitTag, "id" | "builtIn">) {
  return tag.builtIn === true || DEFAULT_TAG_BY_ID.has(tag.id);
}

export function getSplitTagLabelKey(
  tag: Pick<SplitTag, "id">,
): BuiltInSplitTagLabelKey | null {
  return DEFAULT_TAG_LABEL_KEYS[tag.id] ?? null;
}

export function getSplitTagDisplayLabel(
  tag: SplitTag,
  translate?: (key: BuiltInSplitTagLabelKey) => string,
) {
  const labelKey = getSplitTagLabelKey(tag);
  return labelKey && translate ? translate(labelKey) : tag.label;
}

function getBuiltInTagLabels() {
  const labels = new Set<string>();
  DEFAULT_SPLIT_TAGS.forEach((tag) => {
    labels.add(tag.label.trim().toLowerCase());
    const labelKey = getSplitTagLabelKey(tag);
    if (!labelKey) {
      return;
    }
    Object.values(translationCatalog).forEach((catalog) => {
      const label = catalog.plain[labelKey];
      if (label) {
        labels.add(label.trim().toLowerCase());
      }
    });
  });
  return labels;
}

export function normalizeCustomTagIcon(value: string) {
  const normalized = trimName(value);
  if (!normalized) {
    return "";
  }
  const Segmenter = (Intl as any).Segmenter;
  if (typeof Segmenter === "function") {
    const segments = new Segmenter(undefined, {
      granularity: "grapheme",
    }).segment(normalized);
    const first = segments[Symbol.iterator]().next().value?.segment;
    return typeof first === "string"
      ? first.slice(0, CUSTOM_TAG_ICON_MAX_LENGTH)
      : "";
  }
  return normalized.slice(0, CUSTOM_TAG_ICON_MAX_LENGTH);
}

export function createCustomTagIcon(value: string): CustomSplitTagIcon | null {
  const normalized = normalizeCustomTagIcon(value);
  return normalized ? `custom:${normalized}` : null;
}

function normalizeTagIcon(value: unknown): SplitTagIcon | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && value.startsWith("custom:")) {
    const customIcon = createCustomTagIcon(value.slice("custom:".length));
    return customIcon;
  }
  return value === "cart" ||
    value === "cup" ||
    value === "plane" ||
    value === "home" ||
    value === "receipt" ||
    value === "heart" ||
    value === "briefcase"
    ? value
    : "utensils";
}

function normalizeTagColor(value: unknown): SplitTagColor {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())) {
    return value.trim().toLowerCase() as SplitTagColor;
  }
  return value === "mint" || value === "clay" || value === "gray"
    ? value
    : "orange";
}

export function normalizeTagName(value: string) {
  return trimName(value).slice(0, TAG_NAME_MAX_LENGTH);
}

export function sortTagsAlphabetically(
  tags: SplitTag[],
  getLabel: (tag: SplitTag) => string = (tag) => tag.label,
) {
  return [...tags].sort((left, right) =>
    getLabel(left).localeCompare(getLabel(right), undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

export function normalizeTags(value: unknown): SplitTag[] {
  if (!Array.isArray(value)) {
    return DEFAULT_SPLIT_TAGS;
  }

  const seen = new Set<string>();
  const normalized = value
    .map((entry): SplitTag | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const raw = entry as {
        id?: unknown;
        label?: unknown;
        icon?: unknown;
        color?: unknown;
        builtIn?: unknown;
      };
      if (typeof raw.id !== "string" || typeof raw.label !== "string") {
        return null;
      }
      const id = raw.id.trim();
      const label = normalizeTagName(raw.label);
      const key = label.toLowerCase();
      if (!id || !label || seen.has(key)) {
        return null;
      }
      seen.add(key);
      const defaultTag = DEFAULT_TAG_BY_ID.get(id);
      return {
        id,
        label,
        icon:
          raw.icon === undefined && defaultTag
            ? defaultTag.icon
            : normalizeTagIcon(raw.icon),
        color:
          raw.color === undefined && defaultTag
            ? defaultTag.color
            : normalizeTagColor(raw.color),
        ...(raw.builtIn === true ? { builtIn: true } : {}),
      };
    })
    .filter((entry): entry is SplitTag => Boolean(entry));

  return normalized.length > 0 || value.length === 0
    ? normalized
    : DEFAULT_SPLIT_TAGS;
}

export function normalizeTagIds(value: unknown, tags?: SplitTag[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  const validIds = tags ? new Set(tags.map((tag) => tag.id)) : null;
  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== "string") {
      return;
    }
    const id = entry.trim();
    if (!id || seen.has(id) || (validIds && !validIds.has(id))) {
      return;
    }
    seen.add(id);
    normalized.push(id);
  });
  return normalized;
}

export function createCustomTag(
  label: string,
  existingTags: SplitTag[],
  icon: SplitTagIcon | null = "utensils",
  color: SplitTagColor = "orange",
) {
  const normalizedLabel = normalizeTagName(label);
  if (!normalizedLabel) {
    return null;
  }
  const existingLabels = new Set(
    existingTags.map((tag) => tag.label.trim().toLowerCase()),
  );
  const normalizedLabelKey = normalizedLabel.toLowerCase();
  if (
    existingLabels.has(normalizedLabelKey) ||
    getBuiltInTagLabels().has(normalizedLabelKey)
  ) {
    return null;
  }
  return {
    id: createId(),
    label: normalizedLabel,
    icon,
    color,
  } satisfies SplitTag;
}
