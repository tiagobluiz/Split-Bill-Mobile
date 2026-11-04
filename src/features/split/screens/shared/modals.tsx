import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, BackHandler, Platform, Pressable, ScrollView, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { CalendarDays, ChevronDown, Clock3, Trash2 } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import { FONTS, PALETTE } from "../../../../theme/palette";
import { t } from "../../../../i18n";
import { prefers24HourTime } from "../../../../lib/device";
import { screenStyles } from "./styles";
import { FormBottomSheet, FormSheetFooter } from "./FormBottomSheet";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function ActionSheetModal({
  title,
  options,
  onDismiss,
  scrollableOptions = false,
}: {
  title: string;
  options: Array<{
    label: string;
    accessibilityLabel?: string;
    description?: string;
    onPress: () => void;
    tone?: "default" | "danger";
    selected?: boolean;
    disabled?: boolean;
  }>;
  onDismiss: () => void;
  scrollableOptions?: boolean;
}) {
  const optionNodes = options.map((option, index) => (
    <Pressable
      key={`${option.label}-${index}`}
      accessibilityRole="button"
      accessibilityLabel={option.accessibilityLabel ?? option.label}
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
  ));

  return (
    <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel={t("modal.dismissActionSheet")} style={screenStyles.splitNoticeBackdrop} onPress={onDismiss} />
      <View style={screenStyles.actionSheetCard}>
        <YStack gap="$2.5">
          <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>
            {title}
          </Text>
          {scrollableOptions ? (
            <ScrollView
              style={screenStyles.actionSheetOptionsScroll}
              contentContainerStyle={screenStyles.actionSheetOptionsContent}
              showsVerticalScrollIndicator
            >
              {optionNodes}
            </ScrollView>
          ) : (
            optionNodes
          )}
        </YStack>
      </View>
    </View>
  );
}

export function ActionIconGridModal({
  title,
  options,
  onDismiss,
}: {
  title: string;
  options: Array<{
    label: string;
    accessibilityLabel?: string;
    icon: ReactNode;
    onPress: () => void;
    tone?: "default" | "danger";
    disabled?: boolean;
  }>;
  onDismiss: () => void;
}) {
  return (
    <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("modal.dismissActionSheet")}
        style={screenStyles.splitNoticeBackdrop}
        onPress={onDismiss}
      />
      <View style={screenStyles.actionSheetCard}>
        <YStack gap="$3.5">
          <Text
            fontFamily={FONTS.headlineBold}
            fontSize={22}
            color={PALETTE.onSurface}
          >
            {title}
          </Text>
          <XStack style={screenStyles.actionIconGridRow}>
            {options.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityLabel={option.accessibilityLabel ?? option.label}
                accessibilityState={{ disabled: Boolean(option.disabled) }}
                disabled={option.disabled}
                style={[
                  screenStyles.actionIconGridButton,
                  option.tone === "danger"
                    ? screenStyles.actionIconGridButtonDanger
                    : null,
                  option.disabled ? { opacity: 0.55 } : null,
                ]}
                onPress={option.disabled ? undefined : option.onPress}
              >
                <View
                  style={[
                    screenStyles.actionIconGridBadge,
                    option.tone === "danger"
                      ? screenStyles.actionIconGridBadgeDanger
                      : null,
                  ]}
                >
                  {option.icon}
                </View>
                <View style={screenStyles.actionIconGridLabelWrap}>
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={13}
                    color={option.tone === "danger" ? PALETTE.danger : PALETTE.onSurface}
                    lineHeight={17}
                    textAlign="center"
                  >
                    {option.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </XStack>
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
  confirmButtonVariant = "default",
  discardButtonVariant = "default",
  onConfirm,
  onDiscard,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  discardLabel: string;
  confirmButtonVariant?: "default" | "danger";
  discardButtonVariant?: "default" | "secondaryPill";
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
            <Pressable accessibilityRole="button" accessibilityLabel={confirmLabel} style={[screenStyles.splitNoticeButton, confirmButtonVariant === "danger" ? screenStyles.confirmChoiceDangerButton : null]} onPress={onConfirm}>
              <Text fontFamily={FONTS.bodyBold} fontSize={14} color={confirmButtonVariant === "danger" ? PALETTE.danger : PALETTE.onPrimary}>
                {confirmLabel}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={discardLabel}
              style={
                discardButtonVariant === "secondaryPill"
                  ? [screenStyles.splitNoticeButton, screenStyles.splitNoticeButtonSecondary]
                  : screenStyles.confirmChoiceSecondaryButton
              }
              onPress={onDiscard}
            >
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={14}
                color={
                  discardButtonVariant === "secondaryPill"
                    ? PALETTE.onSecondaryContainer
                    : PALETTE.primary
                }
                textAlign="center"
              >
                {discardLabel}
              </Text>
            </Pressable>
          </YStack>
        </YStack>
      </View>
    </View>
  );
}

export function ReminderDateTimeModal({
  title,
  initialIso,
  saveLabel,
  removeLabel,
  onRemove,
  errorMessage,
  onClearError,
  onCancel,
  onSave,
}: {
  title: string;
  initialIso?: string;
  saveLabel: string;
  removeLabel?: string;
  onRemove?: () => void;
  errorMessage?: string;
  onClearError?: () => void;
  onCancel: () => void;
  onSave: (scheduledForIso: string) => void;
}) {
  const [activePickerMode, setActivePickerMode] = useState<"date" | "time" | null>(null);
  const use24HourClock = prefers24HourTime();
  const getDefaultReminderDate = () => new Date(Date.now() + 60 * 60 * 1000);
  const [selectedDate, setSelectedDate] = useState(() => {
    const parsed = initialIso ? new Date(initialIso) : getDefaultReminderDate();
    if (!Number.isFinite(parsed.getTime())) {
      return getDefaultReminderDate();
    }
    return parsed;
  });
  const [localErrorMessage, setLocalErrorMessage] = useState("");
  const combinedErrorMessage = localErrorMessage || errorMessage || "";

  useEffect(() => {
    const parsed = initialIso ? new Date(initialIso) : getDefaultReminderDate();
    if (!Number.isFinite(parsed.getTime())) {
      setSelectedDate(getDefaultReminderDate());
    } else {
      setSelectedDate(parsed);
    }
    setActivePickerMode(null);
    setLocalErrorMessage("");
  }, [initialIso]);
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onCancel();
        return true;
      },
    );
    return () => backSubscription.remove();
  }, [onCancel]);

  const clearErrors = () => {
    if (localErrorMessage) {
      setLocalErrorMessage("");
    }
    if (errorMessage) {
      onClearError?.();
    }
  };

  const handlePickerChange = (_event: DateTimePickerEvent, next?: Date) => {
    if (!next || !Number.isFinite(next.getTime())) {
      setActivePickerMode(null);
      return;
    }
    const mode = activePickerMode;
    if (!mode) {
      return;
    }
    const updatedDate = new Date(selectedDate);
    if (mode === "date") {
      updatedDate.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
    } else {
      updatedDate.setHours(next.getHours(), next.getMinutes(), 0, 0);
    }
    setSelectedDate(updatedDate);
    setActivePickerMode(null);
    clearErrors();
  };

  const openPicker = (mode: "date" | "time") => {
    clearErrors();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode,
        display: "default",
        is24Hour: mode === "time" ? use24HourClock : undefined,
        onChange: (event, next) => {
          if (event.type !== "set" || !next || !Number.isFinite(next.getTime())) {
            return;
          }
          const updatedDate = new Date(selectedDate);
          if (mode === "date") {
            updatedDate.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
          } else {
            updatedDate.setHours(next.getHours(), next.getMinutes(), 0, 0);
          }
          setSelectedDate(updatedDate);
          clearErrors();
        },
      });
      return;
    }
    setActivePickerMode(mode);
  };

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(selectedDate);
  const formattedTime = use24HourClock
    ? `${String(selectedDate.getHours()).padStart(2, "0")}:${String(
        selectedDate.getMinutes(),
      ).padStart(2, "0")}`
    : new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(selectedDate);
  const handleSavePress = () => {
    if (selectedDate.getTime() <= Date.now()) {
      setLocalErrorMessage(t("reminders.errors.futureOnly"));
      return;
    }
    onSave(selectedDate.toISOString());
  };
  const handleRemovePress = () => {
    onRemove?.();
  };

  return (
    <FormBottomSheet title={title} onClose={onCancel}>
        <YStack gap="$3">
          <YStack gap="$2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("reminders.picker.editDate")}
              style={screenStyles.actionSheetButton}
              onPress={() => openPicker("date")}
            >
              <XStack alignItems="center" gap="$3">
                <CalendarDays color={PALETTE.primary} size={23} />
                <YStack flex={1}><Text fontFamily={FONTS.bodyBold} fontSize={13} color={PALETTE.onSurfaceVariant}>{t("reminders.picker.date")}</Text><Text fontFamily={FONTS.bodyMedium} fontSize={16} color={PALETTE.onSurface}>{formattedDate}</Text></YStack>
                <ChevronDown color={PALETTE.primary} size={19} />
              </XStack>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("reminders.picker.editTime")}
              style={screenStyles.actionSheetButton}
              onPress={() => openPicker("time")}
            >
              <XStack alignItems="center" gap="$3">
                <Clock3 color={PALETTE.primary} size={23} />
                <YStack flex={1}><Text fontFamily={FONTS.bodyBold} fontSize={13} color={PALETTE.onSurfaceVariant}>{t("reminders.picker.time")}</Text><Text fontFamily={FONTS.bodyMedium} fontSize={16} color={PALETTE.onSurface}>{formattedTime}</Text></YStack>
                <ChevronDown color={PALETTE.primary} size={19} />
              </XStack>
            </Pressable>
          </YStack>
          {Platform.OS !== "android" && activePickerMode ? (
            <View style={screenStyles.actionSheetButton}>
              <DateTimePicker
                testID={`reminder-${activePickerMode}-picker`}
                value={selectedDate}
                mode={activePickerMode}
                display="default"
                is24Hour={use24HourClock}
                onChange={handlePickerChange}
              />
            </View>
          ) : null}
          {combinedErrorMessage ? (
            <Text
              fontFamily={FONTS.bodyBold}
              fontSize={13}
              lineHeight={19}
              color="#b43d29"
            >
              {combinedErrorMessage}
            </Text>
          ) : null}
          <FormSheetFooter
            primaryLabel={saveLabel}
            onPrimaryPress={handleSavePress}
            cancelLabel={t("common.cancel")}
            onCancel={onCancel}
            beforePrimary={onRemove ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={removeLabel ?? t("reminders.remove")}
                style={screenStyles.reminderRemoveButton}
                onPress={handleRemovePress}
              >
                <Trash2 color="#b43d29" size={18} />
              </Pressable>
            ) : undefined}
          />
        </YStack>
    </FormBottomSheet>
  );
}

export function ToastNotice({
  message,
  bottomOffset = 16,
  actionLabel,
  onAction,
}: {
  message: string;
  bottomOffset?: number;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const announcement = message.trim() && actionLabel && onAction ? `${message} ${actionLabel}` : message;
  useEffect(() => {
    if (Platform.OS === "ios" && announcement.trim()) {
      AccessibilityInfo.announceForAccessibility(announcement);
    }
  }, [announcement]);
  if (!message.trim()) {
    return null;
  }

  return (
    <View
      pointerEvents={onAction ? "box-none" : "none"}
      style={[screenStyles.toastOverlay, { bottom: bottomOffset }]}
    >
      <View pointerEvents={onAction ? "auto" : "none"} style={[screenStyles.toastCard, onAction ? screenStyles.toastCardWithAction : null]}>
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityLabel={announcement} style={onAction ? { flex: 1 } : undefined} fontFamily={FONTS.bodyBold} fontSize={13} color={PALETTE.onPrimary}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} style={screenStyles.undoButton} onPress={onAction}>
            <Text fontFamily={FONTS.bodyBold} fontSize={12} color={PALETTE.onPrimary} textTransform="uppercase" letterSpacing={1.2}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SplitNoticeModal({
  title = t("common.almostThere"),
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
          <Pressable accessibilityRole="button" accessibilityLabel={t("modal.dismissNotice")} style={screenStyles.splitNoticeButton} onPress={onDismiss}>
            <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.onPrimary}>
              {t("common.ok")}
            </Text>
          </Pressable>
        </YStack>
      </View>
    </View>
  );
}
