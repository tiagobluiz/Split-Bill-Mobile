import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text as TamaguiText, XStack as TamaguiXStack, YStack as TamaguiYStack } from "tamagui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { screenStyles } from "./styles";
import { BottomSheetFrame } from "./BottomSheetFrame";
import { SheetCancelButton } from "./SheetCancelButton";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function FormBottomSheet({ title, onClose, children, avoidKeyboard = false, height }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  avoidKeyboard?: boolean;
  height?: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetFrame
      visible
      title={title}
      bottomInset={insets.bottom}
      onDismiss={onClose}
      centeredTitle
      titleFontSize={18}
      overlayStyle={[screenStyles.splitNoticeOverlay, screenStyles.formSheetOverlay]}
      cardStyle={[
        screenStyles.formSheetCard,
        height != null ? { height, maxHeight: height } : null,
        { paddingBottom: Math.max(insets.bottom, 20) },
      ]}
      avoidKeyboard={avoidKeyboard}
      animationType="fade"
    >
      {children}
    </BottomSheetFrame>
  );
}

export function FormSheetFooter({ primaryLabel, onPrimaryPress, cancelLabel, onCancel, primaryDisabled = false, beforePrimary }: {
  primaryLabel: string;
  onPrimaryPress: () => void;
  cancelLabel: string;
  onCancel: () => void;
  primaryDisabled?: boolean;
  beforePrimary?: ReactNode;
}) {
  const primaryButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={primaryLabel}
      disabled={primaryDisabled}
      style={[screenStyles.splitNoticeButton, beforePrimary ? screenStyles.splitNoticeButtonCompact : null, primaryDisabled ? screenStyles.quickEditButtonDisabled : null]}
      onPress={onPrimaryPress}
    >
      <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.onPrimary}>
        {primaryLabel}
      </Text>
    </Pressable>
  );

  return (
    <YStack gap="$2">
      {beforePrimary ? (
        <XStack style={screenStyles.reminderActionRow}>
          {beforePrimary}
          {primaryButton}
        </XStack>
      ) : primaryButton}
      <SheetCancelButton label={cancelLabel} onPress={onCancel} formStyle />
    </YStack>
  );
}
