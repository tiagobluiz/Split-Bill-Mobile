import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { CalendarDays, ChevronDown } from "lucide-react-native";
import { FieldLabel } from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import { FONTS, PALETTE } from "../../../../theme/palette";

export function SplitDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <View style={{ gap: 10 }}>
      <FieldLabel>{t("splitDetails.date")}</FieldLabel>
      <Pressable accessibilityRole="button" accessibilityLabel={t("splitDetails.date")} accessibilityValue={{ text: value }} onPress={() => { setDraft(value); setOpen(true); }} style={{ minHeight: 64, paddingHorizontal: 14, borderRadius: 18, backgroundColor: PALETTE.surfaceContainerLow, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <CalendarDays color={PALETTE.onSurfaceVariant} size={19} />
          <Text style={{ color: PALETTE.onSurface, fontFamily: FONTS.bodyMedium, fontSize: 15 }}>{value}</Text>
        </View>
        <ChevronDown color={PALETTE.onSurfaceVariant} size={19} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(31,26,23,0.36)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: PALETTE.surfaceContainerLowest, padding: 22, borderRadius: 28, gap: 18 }}>
            <Text style={{ color: PALETTE.onSurface, fontFamily: FONTS.headlineBold, fontSize: 19 }}>{t("splitDetails.date")}</Text>
            <input aria-label={t("splitDetails.date")} type="date" value={draft} onChange={(event) => setDraft(event.target.value)} style={{ minHeight: 58, padding: 14, border: `1px solid ${PALETTE.outlineVariant}`, borderRadius: 16, color: PALETTE.onSurface, background: PALETTE.surfaceContainerLow, font: `18px ${FONTS.body}` }} />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ paddingHorizontal: 18, minHeight: 48, borderRadius: 24, justifyContent: "center", backgroundColor: PALETTE.secondaryContainer }}><Text style={{ color: PALETTE.onSecondaryContainer, fontFamily: FONTS.bodyBold }}>{t("common.cancel")}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { if (draft) onChange(draft); setOpen(false); }} style={{ paddingHorizontal: 22, minHeight: 48, borderRadius: 24, justifyContent: "center", backgroundColor: PALETTE.primary }}><Text style={{ color: PALETTE.onPrimary, fontFamily: FONTS.bodyBold }}>{t("common.done")}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
