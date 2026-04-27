import { Pressable, View } from "react-native";
import { Text as TamaguiText, YStack as TamaguiYStack } from "tamagui";

import { FONTS, PALETTE } from "../../../../theme/palette";
import { screenStyles } from "./styles";

const Text = TamaguiText as any;
const YStack = TamaguiYStack as any;

export function ActionSheetModal({
  title,
  options,
  onDismiss,
}: {
  title: string;
  options: Array<{
    label: string;
    description?: string;
    onPress: () => void;
    tone?: "default" | "danger";
    selected?: boolean;
    disabled?: boolean;
  }>;
  onDismiss: () => void;
}) {
  return (
    <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss action sheet" style={screenStyles.splitNoticeBackdrop} onPress={onDismiss} />
      <View style={screenStyles.actionSheetCard}>
        <YStack gap="$2.5">
          <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>
            {title}
          </Text>
          {options.map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityHint={option.description}
              accessibilityState={{
                selected: Boolean(option.selected),
                disabled: Boolean(option.disabled),
              }}
              disabled={option.disabled}
              style={[
                screenStyles.actionSheetButton,
                option.selected ? screenStyles.actionSheetButtonSelected : null,
                option.tone === "danger" ? screenStyles.actionSheetButtonDanger : null,
                option.disabled ? { opacity: 0.55 } : null,
              ]}
              onPress={option.disabled ? undefined : option.onPress}
            >
              <YStack gap="$1.5">
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={15}
                  color={
                    option.disabled
                      ? PALETTE.onSurfaceVariant
                      : option.tone === "danger"
                        ? "#b43d29"
                        : PALETTE.primary
                  }
                >
                  {option.label}
                </Text>
                {option.description ? (
                  <Text
                    fontFamily={FONTS.bodyMedium}
                    fontSize={13}
                    lineHeight={19}
                    color={PALETTE.onSurfaceVariant}
                  >
                    {option.description}
                  </Text>
                ) : null}
              </YStack>
            </Pressable>
          ))}
        </YStack>
      </View>
    </View>
  );
}

export function ConfirmChoiceModal({
  title,
  body,
  confirmLabel,
  discardLabel,
  onConfirm,
  onDiscard,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  discardLabel: string;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  return (
    <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
      <View style={screenStyles.splitNoticeBackdrop} />
      <View style={screenStyles.splitNoticeCard}>
        <YStack gap="$3">
          <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>
            {title}
          </Text>
          <Text fontFamily={FONTS.bodyMedium} fontSize={15} lineHeight={22} color={PALETTE.onSurfaceVariant}>
            {body}
          </Text>
          <YStack gap="$2">
            <Pressable accessibilityRole="button" accessibilityLabel={confirmLabel} style={screenStyles.splitNoticeButton} onPress={onConfirm}>
              <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.onPrimary}>
                {confirmLabel}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={discardLabel} style={screenStyles.actionSheetButton} onPress={onDiscard}>
              <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.primary}>
                {discardLabel}
              </Text>
            </Pressable>
          </YStack>
        </YStack>
      </View>
    </View>
  );
}

export function SplitNoticeModal({
  title = "Almost there",
  messages,
  onDismiss,
}: {
  title?: string;
  messages: string[];
  onDismiss: () => void;
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
      <View style={screenStyles.splitNoticeBackdrop} />
      <View style={screenStyles.splitNoticeCard}>
        <YStack gap="$3">
          <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>
            {title}
          </Text>
          {messages.map((message) => (
            <Text key={message} fontFamily={FONTS.bodyMedium} fontSize={15} lineHeight={22} color={PALETTE.onSurfaceVariant}>
              {message}
            </Text>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss split notice" style={screenStyles.splitNoticeButton} onPress={onDismiss}>
            <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.onPrimary}>
              Okay
            </Text>
          </Pressable>
        </YStack>
      </View>
    </View>
  );
}
