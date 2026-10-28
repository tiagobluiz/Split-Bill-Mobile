import { Pressable, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { FieldLabel } from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import { FONTS, PALETTE } from "../../../../theme/palette";
import type { SplitTag } from "../../tags";
import { getSplitTagDisplayLabel } from "../../tags";
import { TagChip } from "./TagChips";
import { screenStyles } from "./styles";

export function SetupTagPicker({
  tags,
  selectedTagIds,
  onToggle,
  onAdd,
}: {
  tags: SplitTag[];
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 8 }}>
      <FieldLabel>{t("tags.label")}</FieldLabel>
      <View style={screenStyles.tagPickerGrid}>
        {tags.map((tag) => {
          const selected = selectedTagIds.includes(tag.id);
          return (
            <Pressable
              key={tag.id}
              accessibilityRole="button"
              accessibilityLabel={getSplitTagDisplayLabel(tag, t)}
              accessibilityState={{ selected }}
              style={screenStyles.tagFilterOption}
              onPress={() => onToggle(tag.id)}
            >
              <TagChip tag={tag} selected={selected} />
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("tags.add")}
          style={screenStyles.tagPickerAddInline}
          onPress={onAdd}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Plus color={PALETTE.primary} size={13} />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: PALETTE.primary }}>
              {t("tags.add")}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
