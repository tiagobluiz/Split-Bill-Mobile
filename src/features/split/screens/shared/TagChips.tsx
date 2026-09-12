import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  Briefcase,
  Heart,
  Home,
  Plane,
  Receipt,
  ShoppingCart,
  Utensils,
  Wine,
} from "lucide-react-native";
import { Text as TamaguiText, XStack as TamaguiXStack } from "tamagui";

import type {
  BuiltInSplitTagColor,
  BuiltInSplitTagIcon,
  SplitTag,
  SplitTagColor,
  SplitTagIcon,
} from "../../tags";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { screenStyles } from "./styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;

const TAG_COLORS: Record<
  BuiltInSplitTagColor,
  { background: string; foreground: string }
> = {
  orange: { background: "#ffe5d2", foreground: "#9d4401" },
  mint: { background: "#dff5ee", foreground: "#0d7c67" },
  clay: { background: "#f0d3ba", foreground: "#7f451c" },
  gray: { background: "#e9e5e1", foreground: "#5f5550" },
};

const TAG_ICONS: Record<BuiltInSplitTagIcon, typeof Utensils> = {
  utensils: Utensils,
  cart: ShoppingCart,
  cup: Wine,
  plane: Plane,
  home: Home,
  receipt: Receipt,
  heart: Heart,
  briefcase: Briefcase,
};

function isBuiltInTagColor(
  color: SplitTagColor,
): color is BuiltInSplitTagColor {
  return (
    color === "orange" ||
    color === "mint" ||
    color === "clay" ||
    color === "gray"
  );
}

function isBuiltInTagIcon(icon: SplitTagIcon): icon is BuiltInSplitTagIcon {
  return (
    icon === "utensils" ||
    icon === "cart" ||
    icon === "cup" ||
    icon === "plane" ||
    icon === "home" ||
    icon === "receipt" ||
    icon === "heart" ||
    icon === "briefcase"
  );
}

export function getTagColorStyle(color: SplitTagColor) {
  if (color.startsWith("#") && /^#[0-9a-f]{6}$/i.test(color)) {
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
    return {
      background: color,
      foreground: luminance > 0.58 ? PALETTE.onSurface : PALETTE.onPrimary,
    };
  }
  return isBuiltInTagColor(color) ? TAG_COLORS[color] : TAG_COLORS.orange;
}

export function getTagIcon(icon: SplitTagIcon | null) {
  if (!icon) {
    return null;
  }
  return isBuiltInTagIcon(icon) ? TAG_ICONS[icon] : null;
}

function getCustomTagIconLabel(icon: SplitTagIcon | null) {
  return icon?.startsWith("custom:") ? icon.slice("custom:".length) : "";
}

export function TagChip({
  tag,
  label,
  muted = false,
  selected = false,
}: {
  tag?: SplitTag;
  label?: string;
  muted?: boolean;
  selected?: boolean;
}) {
  const colors = tag ? getTagColorStyle(tag.color) : TAG_COLORS.gray;
  const Icon = tag ? getTagIcon(tag.icon) : null;
  const customIconLabel = tag ? getCustomTagIconLabel(tag.icon) : "";
  return (
    <View
      style={[
        screenStyles.tagChip,
        selected ? screenStyles.tagChipSelected : null,
        {
          backgroundColor: muted
            ? TAG_COLORS.gray.background
            : colors.background,
        },
      ]}
    >
      {Icon ? <Icon color={colors.foreground} size={12} /> : null}
      {!Icon && customIconLabel ? (
        <Text
          fontFamily={FONTS.bodyBold}
          fontSize={11}
          color={colors.foreground}
          numberOfLines={1}
        >
          {customIconLabel}
        </Text>
      ) : null}
      <Text
        fontFamily={FONTS.bodyBold}
        fontSize={11}
        color={muted ? PALETTE.onSurfaceVariant : colors.foreground}
        numberOfLines={1}
      >
        {label ?? tag?.label}
      </Text>
    </View>
  );
}

export function TagChipRow({
  tags,
  selectedIds,
}: {
  tags: SplitTag[];
  selectedIds: string[];
}) {
  const selectedTags = useMemo(() => {
    const byId = new Map(tags.map((tag) => [tag.id, tag]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((tag): tag is SplitTag => Boolean(tag));
  }, [selectedIds, tags]);
  const [rowWidth, setRowWidth] = useState(0);
  const [chipWidths, setChipWidths] = useState<Record<string, number>>({});

  if (selectedTags.length === 0) {
    return null;
  }

  let visibleCount = selectedTags.length;
  if (rowWidth > 0 && Object.keys(chipWidths).length >= selectedTags.length) {
    const gap = 6;
    let used = 0;
    visibleCount = 0;
    for (const tag of selectedTags) {
      const nextWidth = chipWidths[tag.id] ?? 0;
      const remaining = selectedTags.length - visibleCount - 1;
      const moreWidth = remaining > 0 ? 42 : 0;
      const candidate =
        used +
        (visibleCount > 0 ? gap : 0) +
        nextWidth +
        (remaining > 0 ? gap + moreWidth : 0);
      if (candidate > rowWidth) {
        break;
      }
      used += (visibleCount > 0 ? gap : 0) + nextWidth;
      visibleCount += 1;
    }
  }
  const hiddenCount = selectedTags.length - visibleCount;

  return (
    <View
      testID="tag-row-viewport"
      style={screenStyles.tagRowViewport}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        setRowWidth(nextWidth);
      }}
    >
      <XStack gap="$1.5" alignItems="center" flexWrap="nowrap">
        {selectedTags.slice(0, visibleCount).map((tag) => (
          <View
            key={tag.id}
            testID={`tag-row-visible-${tag.id}`}
            onLayout={(event) => {
              const nextWidth = event.nativeEvent.layout.width;
              setChipWidths((current) => ({
                ...current,
                [tag.id]: nextWidth,
              }));
            }}
          >
            <TagChip tag={tag} />
          </View>
        ))}
        {hiddenCount > 0 ? <TagChip label={`+${hiddenCount}`} muted /> : null}
      </XStack>
      <View style={screenStyles.tagMeasurementRow} pointerEvents="none">
        {selectedTags.map((tag) => (
          <View
            key={tag.id}
            testID={`tag-row-measure-${tag.id}`}
            onLayout={(event) => {
              const nextWidth = event.nativeEvent.layout.width;
              setChipWidths((current) => ({
                ...current,
                [tag.id]: nextWidth,
              }));
            }}
          >
            <TagChip tag={tag} />
          </View>
        ))}
      </View>
    </View>
  );
}
