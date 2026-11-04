import { Pressable } from "react-native";
import { Text as TamaguiText } from "tamagui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { screenStyles } from "./styles";

const Text = TamaguiText as any;

export function SheetCancelButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={screenStyles.formSheetCancel}
    >
      <Text
        fontFamily={FONTS.bodyBold}
        fontSize={14}
        color={PALETTE.onSurface}
      >
        {label}
      </Text>
    </Pressable>
  );
}
