import { Pressable, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import {
  Paragraph as TamaguiParagraph,
  Text as TamaguiText,
  XStack as TamaguiXStack,
} from "tamagui";

import { SectionEyebrow } from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { screenStyles } from "./styles";

const Paragraph = TamaguiParagraph as any;
const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;

export function FlowContinueButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const foregroundColor = disabled
    ? PALETTE.onSurfaceVariant
    : PALETTE.onPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      style={[
        screenStyles.itemsNextButton,
        disabled ? screenStyles.participantsContinueButtonDisabled : null,
      ]}
    >
      <View style={screenStyles.flowContinueButtonContent}>
        <View style={screenStyles.flowContinueButtonIconSlot} />
        <Text
          fontFamily={FONTS.headlineBlack}
          fontSize={18}
          color={foregroundColor}
          style={screenStyles.flowContinueButtonLabel}
        >
          {label}
        </Text>
        <View style={screenStyles.flowContinueButtonIconSlot}>
          <ArrowRight color={foregroundColor} size={20} />
        </View>
      </View>
    </Pressable>
  );
}

export function ModePills({
  active,
  options,
  onChange,
}: {
  active: string;
  options: Array<{ key: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={screenStyles.modePillShell}>
      {options.map((option) => {
        const selected = option.key === active;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={[screenStyles.modePillButton, selected ? screenStyles.modePillButtonActive : null]}
            onPress={() => onChange(option.key)}
          >
            <Text
              fontFamily={selected ? FONTS.bodyBold : FONTS.bodyMedium}
              fontSize={14}
              color={selected ? PALETTE.primary : PALETTE.onSurfaceVariant}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ErrorList({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <View style={screenStyles.errorPanel}>
      <SectionEyebrow>Not there yet...</SectionEyebrow>
      {messages.map((message, index) => (
        <Paragraph key={`${message}-${index}`} color={PALETTE.danger} fontFamily={FONTS.bodyMedium} fontSize={13}>
          {message}
        </Paragraph>
      ))}
    </View>
  );
}

export function ModeToggle({
  active,
  onChange,
}: {
  active: "even" | "shares" | "percent";
  onChange: (value: "even" | "shares" | "percent") => void;
}) {
  const { t } = useTranslation();
  const options = [
    { key: "even", label: t("flow.splitItem.mode.even") },
    { key: "shares", label: t("flow.splitItem.mode.shares") },
    { key: "percent", label: t("flow.splitItem.mode.percent") },
  ] as const;

  return (
    <XStack gap="$1.5">
      {options.map((option) => {
        const selected = active === option.key;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={t("flow.splitItem.mode.select", {
              mode: option.label,
            })}
            accessibilityState={{ selected }}
            style={[screenStyles.togglePill, selected ? screenStyles.modePillButtonActive : null]}
            onPress={() => onChange(option.key)}
          >
            <Text
              fontFamily={selected ? FONTS.bodyBold : FONTS.body}
              fontSize={13}
              color={selected ? PALETTE.primary : PALETTE.onSurfaceVariant}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </XStack>
  );
}
