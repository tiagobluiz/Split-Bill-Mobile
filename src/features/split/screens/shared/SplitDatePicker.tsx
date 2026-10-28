import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarDays, ChevronDown } from "lucide-react-native";
import { FieldLabel } from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import { FONTS, PALETTE } from "../../../../theme/palette";

function localDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

const dateButtonStyle = {
  minHeight: 64,
  paddingHorizontal: 14,
  borderRadius: 18,
  backgroundColor: PALETTE.surfaceContainerLow,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
};

export function SplitDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date(`${value}T12:00:00`));
  const show = () => {
    const selected = new Date(`${value}T12:00:00`);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: selected, mode: "date", onChange: (event, date) => { if (event.type === "set" && date) onChange(localDate(date)); } });
    } else {
      setDraft(selected);
      setOpen(true);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <FieldLabel>{t("splitDetails.date")}</FieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("splitDetails.date")}
        accessibilityValue={{ text: value }}
        onPress={show}
        style={dateButtonStyle}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <CalendarDays color={PALETTE.onSurfaceVariant} size={19} />
          <Text style={{ color: PALETTE.onSurface, fontFamily: FONTS.bodyMedium, fontSize: 15 }}>{value}</Text>
        </View>
        <ChevronDown color={PALETTE.onSurfaceVariant} size={19} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(31,26,23,0.36)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: PALETTE.surfaceContainerLowest, padding: 20, borderRadius: 28, gap: 16 }}>
            <Text style={{ color: PALETTE.onSurface, fontFamily: FONTS.headlineBold, fontSize: 19 }}>{t("splitDetails.date")}</Text>
            <DateTimePicker value={draft} mode="date" display="inline" onChange={(_, date) => { if (date) setDraft(date); }} />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ paddingHorizontal: 18, minHeight: 48, borderRadius: 24, justifyContent: "center", backgroundColor: PALETTE.secondaryContainer }}>
                <Text style={{ color: PALETTE.onSecondaryContainer, fontFamily: FONTS.bodyBold }}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { onChange(localDate(draft)); setOpen(false); }} style={{ paddingHorizontal: 22, minHeight: 48, borderRadius: 24, justifyContent: "center", backgroundColor: PALETTE.primary }}>
                <Text style={{ color: PALETTE.onPrimary, fontFamily: FONTS.bodyBold }}>{t("common.done")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
