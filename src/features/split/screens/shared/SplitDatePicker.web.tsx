import { FormBottomSheet, FormSheetFooter } from "./FormBottomSheet";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
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
      {open ? <FormBottomSheet title={t("splitDetails.date")} onClose={() => setOpen(false)}>
            <input aria-label={t("splitDetails.date")} type="date" value={draft} onChange={(event) => setDraft(event.target.value)} style={{ minHeight: 58, padding: 14, border: `1px solid ${PALETTE.outlineVariant}`, borderRadius: 16, color: PALETTE.onSurface, background: PALETTE.surfaceContainerLow, font: `18px ${FONTS.body}` }} />
        <FormSheetFooter primaryLabel={t("common.done")} onPrimaryPress={() => { if (draft) onChange(draft); setOpen(false); }} cancelLabel={t("common.cancel")} onCancel={() => setOpen(false)} />
      </FormBottomSheet> : null}
    </View>
  );
}
