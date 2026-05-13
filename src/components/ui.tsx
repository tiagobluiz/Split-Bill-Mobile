import { useCallback, useMemo, useState, type PropsWithChildren, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Circle as TamaguiCircle,
  Paragraph as TamaguiParagraph,
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import { FONTS, PALETTE } from "../theme/palette";

const FOOTER_SIDE_PADDING = 20;
const FOOTER_TOP_PADDING = 8;
const FOOTER_BOTTOM_MIN_INSET = 14;
const DEFAULT_FOOTER_FALLBACK_HEIGHT = 154;
const DEFAULT_FOOTER_CONTENT_GAP = 16;
const DEFAULT_SCROLL_BOTTOM_SPACER = 28;
const Circle = TamaguiCircle as any;
const Paragraph = TamaguiParagraph as any;
const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function AppScreen({
  children,
  scroll = true,
  footer,
}: PropsWithChildren<{ scroll?: boolean; footer?: ReactNode }>) {
  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.flex}>{children}</View>
  );

  return (
    <View style={styles.screen}>
      {content}
      {footer ? (
        <View style={styles.footerHost}>{footer}</View>
      ) : null}
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <XStack justifyContent="space-between" alignItems="flex-start" gap="$4">
      <YStack flex={1} gap="$2">
        <Text fontFamily={FONTS.headlineBlack} fontSize={28} color={PALETTE.primary} letterSpacing={-1}>
          {title}
        </Text>
        {subtitle ? (
          <Paragraph color={PALETTE.onSurfaceVariant} fontFamily={FONTS.body} fontSize={14} lineHeight={20}>
            {subtitle}
          </Paragraph>
        ) : null}
      </YStack>
      {trailing}
    </XStack>
  );
}

export function HeroCard({
  eyebrow,
  title,
  subtitle,
  children,
}: PropsWithChildren<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
}>) {
  return (
    <LinearGradient colors={[PALETTE.primary, PALETTE.tertiary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroGlow} />
      {eyebrow ? (
        <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.heroEyebrow} textTransform="uppercase" letterSpacing={2}>
          {eyebrow}
        </Text>
      ) : null}
      <Text fontFamily={FONTS.headlineBlack} fontSize={34} color={PALETTE.onPrimary} letterSpacing={-1.5}>
        {title}
      </Text>
      {subtitle ? (
        <Paragraph color={PALETTE.heroSubtitle} fontFamily={FONTS.bodyMedium} fontSize={15} lineHeight={22}>
          {subtitle}
        </Paragraph>
      ) : null}
      {children}
    </LinearGradient>
  );
}

export function SectionCard({ children, soft = false }: PropsWithChildren<{ soft?: boolean }>) {
  return <YStack backgroundColor={soft ? PALETTE.surfaceContainerLow : PALETTE.surfaceContainerLowest} padding="$5" borderRadius={24} gap="$4" style={soft ? undefined : styles.cardShadow}>{children}</YStack>;
}

export function SectionEyebrow({ children }: PropsWithChildren) {
  return (
    <Text
      fontFamily={FONTS.bodyBold}
      fontSize={11}
      color={PALETTE.onSurfaceVariant}
      textTransform="uppercase"
      letterSpacing={2}
    >
      {children}
    </Text>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: disabled ? PALETTE.surfaceContainerHighest : PALETTE.primary },
        pressed && !disabled ? styles.buttonPressed : null,
      ]}
    >
      <XStack alignItems="center" justifyContent="center" gap="$2">
        {icon}
        <Text color={disabled ? PALETTE.onSurfaceVariant : PALETTE.onPrimary} fontFamily={FONTS.headlineBold} fontSize={17}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        styles.secondaryButton,
        disabled ? styles.secondaryButtonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null,
      ]}
    >
      <XStack alignItems="center" justifyContent="center" gap="$2">
        {icon}
        <Text color={disabled ? PALETTE.onSurfaceVariant : PALETTE.onSecondaryContainer} fontFamily={FONTS.headlineBold} fontSize={17}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}

export function QuietButton({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.quietButton,
        disabled ? styles.quietButtonDisabled : null,
        pressed && !disabled ? { opacity: 0.7 } : null,
      ]}
    >
      <Text color={disabled ? PALETTE.onSurfaceVariant : PALETTE.primary} fontFamily={FONTS.bodyBold} fontSize={14}>
        {label}
      </Text>
    </Pressable>
  );
}

export function FloatingFooter({ children }: PropsWithChildren) {
  return (
    <View style={styles.footerFrame}>
      {children}
    </View>
  );
}

export function FooterBubble({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.footerBubble, style]}>{children}</View>;
}

export function useFloatingFooterInset(options?: {
  fallbackHeight?: number;
  contentSafetyGap?: number;
}) {
  const fallbackHeight = options?.fallbackHeight ?? DEFAULT_FOOTER_FALLBACK_HEIGHT;
  const contentSafetyGap =
    options?.contentSafetyGap ?? DEFAULT_FOOTER_CONTENT_GAP;
  const [measuredFooterHeight, setMeasuredFooterHeight] = useState(0);

  const onMeasuredHeight = useCallback((height: number) => {
    const roundedHeight = Math.max(0, Math.round(height));
    setMeasuredFooterHeight((current) =>
      current === roundedHeight ? current : roundedHeight,
    );
  }, []);

  const insetBottom = useMemo(
    () =>
      (measuredFooterHeight > 0 ? measuredFooterHeight : fallbackHeight) +
      contentSafetyGap,
    [contentSafetyGap, fallbackHeight, measuredFooterHeight],
  );

  return {
    insetBottom,
    measuredFooterHeight,
    onMeasuredHeight,
  };
}

export function MeasuredFloatingFooter({
  children,
  onMeasuredHeight,
}: PropsWithChildren<{
  onMeasuredHeight?: (height: number) => void;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="measured-floating-footer"
      onLayout={(event) => {
        onMeasuredHeight?.(event.nativeEvent.layout.height);
      }}
      style={[
        styles.footerFrame,
        { paddingBottom: Math.max(insets.bottom, FOOTER_BOTTOM_MIN_INSET) },
      ]}
    >
      {children}
    </View>
  );
}

export function StackedFloatingFooter({
  children,
  onMeasuredHeight,
}: PropsWithChildren<{ onMeasuredHeight?: (height: number) => void }>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="stacked-floating-footer"
      onLayout={(event) => {
        onMeasuredHeight?.(event.nativeEvent.layout.height);
      }}
      style={[
        styles.footerFrame,
        { paddingBottom: Math.max(insets.bottom, FOOTER_BOTTOM_MIN_INSET) },
      ]}
    >
      <YStack gap="$3">{children}</YStack>
    </View>
  );
}

export function SoftInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={PALETTE.inputPlaceholder}
      keyboardType={keyboardType}
      multiline={multiline}
      style={[styles.input, multiline ? styles.multiline : null]}
    />
  );
}

export function FieldLabel({ children }: PropsWithChildren) {
  return (
    <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.onSurfaceVariant} textTransform="uppercase" letterSpacing={1.6}>
      {children}
    </Text>
  );
}

export function AvatarBadge({
  label,
  accent = false,
}: {
  label: string;
  accent?: boolean;
}) {
  return (
    <Circle
      size={42}
      backgroundColor={accent ? PALETTE.secondaryContainer : PALETTE.primaryContainer}
      alignItems="center"
      justifyContent="center"
    >
      <Text fontFamily={FONTS.bodyBold} color={accent ? PALETTE.onSecondaryContainer : PALETTE.onPrimaryContainer}>
        {label}
      </Text>
    </Circle>
  );
}

export function StatPill({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <SectionCard>
      <SectionEyebrow>{label}</SectionEyebrow>
      <Text fontFamily={FONTS.headlineBlack} fontSize={30} color={positive ? PALETTE.success : PALETTE.onSurface}>
        {value}
      </Text>
    </SectionCard>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <SectionCard soft>
      <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>
        {title}
      </Text>
      <Paragraph color={PALETTE.onSurfaceVariant} fontFamily={FONTS.body} fontSize={14} lineHeight={22}>
        {description}
      </Paragraph>
    </SectionCard>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: PALETTE.surface },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: DEFAULT_SCROLL_BOTTOM_SPACER,
    gap: 24,
  },
  nonScrollContentWithFooter: {},
  hero: {
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 10,
    overflow: "hidden",
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  heroGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: PALETTE.heroGlow,
  },
  cardShadow: {
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  button: {
    borderRadius: 24,
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: PALETTE.secondaryContainer,
    borderWidth: 1,
    borderColor: PALETTE.outlineVariant,
  },
  secondaryButtonDisabled: {
    backgroundColor: PALETTE.surfaceContainerHighest,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  quietButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  quietButtonDisabled: {
    opacity: 0.72,
  },
  footerHost: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 20,
    elevation: 20,
    overflow: "visible",
  },
  footerFrame: {
    paddingHorizontal: FOOTER_SIDE_PADDING,
    paddingTop: FOOTER_TOP_PADDING,
    paddingBottom: FOOTER_BOTTOM_MIN_INSET,
  },
  footerBubble: {
    backgroundColor: PALETTE.surfaceContainerLowest,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: PALETTE.outlineVariant,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  input: {
    minHeight: 56,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: PALETTE.surfaceContainerLow,
    color: PALETTE.onSurface,
    fontFamily: FONTS.body,
    fontSize: 16,
  },
  multiline: {
    minHeight: 148,
    textAlignVertical: "top",
  },
});
