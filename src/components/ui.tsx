// @ts-nocheck
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Circle, Paragraph, Text, XStack, YStack } from "tamagui";

import { FONTS, PALETTE } from "../theme/palette";

const FOOTER_PADDING_TOP = 18;
const FOOTER_PADDING_BOTTOM = 28;
const FOOTER_OVERLAY_HEIGHT = 132;
const SCROLL_BOTTOM_SPACER = FOOTER_OVERLAY_HEIGHT + FOOTER_PADDING_TOP + FOOTER_PADDING_BOTTOM + 20;

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
    <View style={[styles.flex, footer ? styles.nonScrollContentWithFooter : null]}>{children}</View>
  );

  return (
    <View style={styles.screen}>
      {content}
      {footer ? <View style={styles.footerHost}>{footer}</View> : null}
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
    <LinearGradient colors={[PALETTE.primary, PALETTE.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
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
      style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && !disabled ? styles.buttonPressed : null]}
    >
      <XStack alignItems="center" justifyContent="center" gap="$2">
        {icon}
        <Text color={PALETTE.onSecondaryContainer} fontFamily={FONTS.headlineBold} fontSize={17}>
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
      style={({ pressed }) => [styles.quietButton, pressed && !disabled ? { opacity: 0.7 } : null]}
    >
      <Text color={PALETTE.primary} fontFamily={FONTS.bodyBold} fontSize={14}>
        {label}
      </Text>
    </Pressable>
  );
}

export function FloatingFooter({ children }: PropsWithChildren) {
  return <View style={styles.footer}>{children}</View>;
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
      <Text fontFamily={FONTS.headlineBlack} fontSize={30} color={positive ? PALETTE.secondary : PALETTE.onSurface}>
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
  scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: SCROLL_BOTTOM_SPACER, gap: 24 },
  nonScrollContentWithFooter: {
    paddingBottom: FOOTER_OVERLAY_HEIGHT,
  },
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
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  quietButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  footerHost: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: FOOTER_PADDING_TOP,
    paddingBottom: FOOTER_PADDING_BOTTOM,
    backgroundColor: PALETTE.footerGlass,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
