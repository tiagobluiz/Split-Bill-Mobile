import { FormBottomSheet, FormSheetFooter } from "./FormBottomSheet";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
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
      {open ? <FormBottomSheet title={t("splitDetails.date")} onClose={() => setOpen(false)}>
            <DateTimePicker value={draft} mode="date" display="inline" onChange={(_, date) => { if (date) setDraft(date); }} />
        <FormSheetFooter primaryLabel={t("common.done")} onPrimaryPress={() => { onChange(localDate(draft)); setOpen(false); }} cancelLabel={t("common.cancel")} onCancel={() => setOpen(false)} />
      </FormBottomSheet> : null}
    </View>
  );
}
