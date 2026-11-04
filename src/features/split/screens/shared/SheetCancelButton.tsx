import { Pressable } from "react-native";
import { Text as TamaguiText } from "tamagui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { screenStyles } from "./styles";

const Text = TamaguiText as any;

export function SheetCancelButton({ label, onPress, formStyle = false }: { label: string; onPress: () => void; formStyle?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={formStyle ? screenStyles.formSheetCancel : screenStyles.personPhotoSheetCancel}
    >
      <Text
        fontFamily={formStyle ? FONTS.bodyBold : FONTS.bodySemiBold}
        fontSize={formStyle ? 14 : 17}
        color={PALETTE.onSurface}
      >
        {label}
      </Text>
    </Pressable>
  );
}
