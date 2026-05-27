import type { RefObject } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Bell, Trash2 } from "lucide-react-native";
import {
  Text as TamaguiText,
  YStack as TamaguiYStack,
} from "tamagui";

import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import type { HomeTabKey } from "../shared/homeParts";
import {
  ActionIconGridModal,
  ActionSheetModal,
  ConfirmChoiceModal,
  ReminderDateTimeModal,
  SplitNoticeModal,
  ToastNotice,
} from "../shared/modals";
import type {
  HomeRecord,
  RecordActionTarget,
  SelectableSplitListAmountDisplayOption,
} from "./homeTypes";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const YStack = TamaguiYStack as any;

type CurrencyOption = {
  code: string;
  label: string;
};

export function HomeOverlayStack({
  settingsNoticeTitle,
  settingsNoticeMessages,
  onDismissSettingsNotice,
  selectedRecordActionTarget,
  onDismissRecordActionTarget,
  onRecordActionReminder,
  onRecordActionDelete,
  splitReminderPickerRecord,
  splitReminderPickerHasExisting,
  splitReminderErrorMessage,
  onClearSplitReminderError,
  onCancelSplitReminder,
  onRemoveSplitReminder,
  onSaveSplitReminder,
  reminderToastMessage,
  footerInsetBottom,
  profileActionMenuOpen,
  setProfileActionMenuOpen,
  ownerProfileImageUriDraft,
  setOwnerProfileImageUriDraft,
  onPickProfileImage,
  currencyMenuOpen,
  setCurrencyMenuOpen,
  draftCurrencyOptions,
  defaultCurrencyDraft,
  setDefaultCurrencyDraft,
  setCurrencyModalOpen,
  languageMenuOpen,
  setLanguageMenuOpen,
  languageDraft,
  setLanguageDraft,
  humourMenuOpen,
  setHumourMenuOpen,
  humourDraft,
  setHumourDraft,
  splitListAmountDisplayMenuOpen,
  setSplitListAmountDisplayMenuOpen,
  availableSplitListAmountDisplayOptions,
  splitListAmountDisplayDraft,
  setSplitListAmountDisplayDraft,
  currencyModalOpen,
  customCurrencyErrors,
  customCurrencyName,
  setCustomCurrencyName,
  customCurrencySymbol,
  setCustomCurrencySymbol,
  setCustomCurrencyErrors,
  customCurrencySymbolInputRef,
  addCustomCurrency,
  closeCustomCurrencyModal,
  pendingTabChange,
  onConfirmPendingTabChange,
  onDiscardPendingTabChange,
}: {
  settingsNoticeTitle: string;
  settingsNoticeMessages: string[];
  onDismissSettingsNotice: () => void;
  selectedRecordActionTarget: RecordActionTarget | null;
  onDismissRecordActionTarget: () => void;
  onRecordActionReminder: () => void;
  onRecordActionDelete: () => void;
  splitReminderPickerRecord: HomeRecord | undefined;
  splitReminderPickerHasExisting: boolean;
  splitReminderErrorMessage: string;
  onClearSplitReminderError: () => void;
  onCancelSplitReminder: () => void;
  onRemoveSplitReminder: () => void;
  onSaveSplitReminder: (scheduledForIso: string) => void;
  reminderToastMessage: string;
  footerInsetBottom: number;
  profileActionMenuOpen: boolean;
  setProfileActionMenuOpen: (value: boolean) => void;
  ownerProfileImageUriDraft: string;
  setOwnerProfileImageUriDraft: (value: string) => void;
  onPickProfileImage: (mode: "camera" | "library") => Promise<void>;
  currencyMenuOpen: boolean;
  setCurrencyMenuOpen: (value: boolean) => void;
  draftCurrencyOptions: CurrencyOption[];
  defaultCurrencyDraft: string;
  setDefaultCurrencyDraft: (value: string) => void;
  setCurrencyModalOpen: (value: boolean) => void;
  languageMenuOpen: boolean;
  setLanguageMenuOpen: (value: boolean) => void;
  languageDraft: "en" | "pt";
  setLanguageDraft: (value: "en" | "pt") => void;
  humourMenuOpen: boolean;
  setHumourMenuOpen: (value: boolean) => void;
  humourDraft: "plain" | "sassy" | "unhinged";
  setHumourDraft: (value: "plain" | "sassy" | "unhinged") => void;
  splitListAmountDisplayMenuOpen: boolean;
  setSplitListAmountDisplayMenuOpen: (value: boolean) => void;
  availableSplitListAmountDisplayOptions: SelectableSplitListAmountDisplayOption[];
  splitListAmountDisplayDraft:
    | "remaining"
    | "total"
    | "userPaid"
    | "totalAndRemaining";
  setSplitListAmountDisplayDraft: (
    value: "remaining" | "total" | "userPaid" | "totalAndRemaining",
  ) => void;
  currencyModalOpen: boolean;
  customCurrencyErrors: { name: boolean; symbol: boolean };
  customCurrencyName: string;
  setCustomCurrencyName: (value: string) => void;
  customCurrencySymbol: string;
  setCustomCurrencySymbol: (value: string) => void;
  setCustomCurrencyErrors: (
    value:
      | { name: boolean; symbol: boolean }
      | ((current: { name: boolean; symbol: boolean }) => {
          name: boolean;
          symbol: boolean;
        }),
  ) => void;
  customCurrencySymbolInputRef: RefObject<TextInput | null>;
  addCustomCurrency: () => Promise<void>;
  closeCustomCurrencyModal: () => void;
  pendingTabChange: HomeTabKey | null;
  onConfirmPendingTabChange: () => void;
  onDiscardPendingTabChange: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <SplitNoticeModal
        title={settingsNoticeTitle}
        messages={settingsNoticeMessages}
        onDismiss={onDismissSettingsNotice}
      />
      {selectedRecordActionTarget ? (
        <ActionIconGridModal
          title={t("home.rowActions.title")}
          options={[
            {
              label: t("reminders.actionsTitle"),
              icon: <Bell color={PALETTE.primary} size={18} />,
              onPress: onRecordActionReminder,
            },
            {
              label: t("home.rowActions.delete"),
              accessibilityLabel: t("home.rowActions.deleteA11y", {
                title: selectedRecordActionTarget.title,
              }),
              icon: <Trash2 color={PALETTE.danger} size={18} />,
              tone: "danger",
              onPress: onRecordActionDelete,
            },
          ]}
          onDismiss={onDismissRecordActionTarget}
        />
      ) : null}
      {splitReminderPickerRecord ? (
        <ReminderDateTimeModal
          title={t("reminders.picker.title")}
          initialIso={splitReminderPickerRecord.reminderState?.splitReminder?.scheduledForIso}
          saveLabel={
            splitReminderPickerHasExisting
              ? t("reminders.update")
              : t("reminders.set")
          }
          errorMessage={splitReminderErrorMessage}
          onClearError={onClearSplitReminderError}
          onCancel={onCancelSplitReminder}
          onRemove={splitReminderPickerHasExisting ? onRemoveSplitReminder : undefined}
          onSave={onSaveSplitReminder}
        />
      ) : null}
      <ToastNotice
        message={reminderToastMessage}
        bottomOffset={footerInsetBottom + 12}
      />
      {profileActionMenuOpen ? (
        <ActionSheetModal
          title={t("settings.profilePicture")}
          onDismiss={() => setProfileActionMenuOpen(false)}
          options={[
            ...(ownerProfileImageUriDraft
              ? [
                  {
                    label: t("settings.profilePictureRemove"),
                    tone: "danger" as const,
                    onPress: () => {
                      setOwnerProfileImageUriDraft("");
                      setProfileActionMenuOpen(false);
                    },
                  },
                ]
              : []),
            {
              label: t("settings.profilePictureTake"),
              onPress: () => void onPickProfileImage("camera"),
            },
            {
              label: t("settings.profilePictureUpload"),
              onPress: () => void onPickProfileImage("library"),
            },
            {
              label: t("common.cancel"),
              onPress: () => setProfileActionMenuOpen(false),
            },
          ]}
        />
      ) : null}
      {currencyMenuOpen ? (
        <ActionSheetModal
          title={t("settings.defaultCurrency")}
          scrollableOptions
          options={[
            ...draftCurrencyOptions.map((option) => ({
              label: option.label,
              selected: defaultCurrencyDraft === option.code,
              onPress: () => {
                setDefaultCurrencyDraft(option.code);
                setCurrencyMenuOpen(false);
              },
            })),
            {
              label: t("common.other"),
              accessibilityLabel: t("settings.currencyPickerOther"),
              onPress: () => {
                setCurrencyMenuOpen(false);
                setCurrencyModalOpen(true);
              },
            },
          ]}
          onDismiss={() => setCurrencyMenuOpen(false)}
        />
      ) : null}
      {languageMenuOpen ? (
        <ActionSheetModal
          title={t("settings.pickLanguage")}
          options={[
            {
              label: t("settings.language.en"),
              selected: languageDraft === "en",
              onPress: () => {
                setLanguageDraft("en");
                setLanguageMenuOpen(false);
              },
            },
            {
              label: t("settings.language.pt"),
              selected: languageDraft === "pt",
              onPress: () => {
                setLanguageDraft("pt");
                setLanguageMenuOpen(false);
              },
            },
          ]}
          onDismiss={() => setLanguageMenuOpen(false)}
        />
      ) : null}
      {humourMenuOpen ? (
        <ActionSheetModal
          title={t("settings.pickTone")}
          options={[
            {
              label: t("settings.humour.plain"),
              selected: humourDraft === "plain",
              onPress: () => {
                setHumourDraft("plain");
                setHumourMenuOpen(false);
              },
            },
            {
              label: t("settings.humour.sassy"),
              selected: humourDraft === "sassy",
              onPress: () => {
                setHumourDraft("sassy");
                setHumourMenuOpen(false);
              },
            },
            {
              label: t("settings.humour.unhinged"),
              selected: humourDraft === "unhinged",
              onPress: () => {
                setHumourDraft("unhinged");
                setHumourMenuOpen(false);
              },
            },
          ]}
          onDismiss={() => setHumourMenuOpen(false)}
        />
      ) : null}
      {splitListAmountDisplayMenuOpen ? (
        <ActionSheetModal
          title={t("settings.splitRowsPickerTitle")}
          options={availableSplitListAmountDisplayOptions.map((option) => ({
            label: option.label,
            description: option.description,
            selected: option.key === splitListAmountDisplayDraft,
            disabled: option.disabled,
            onPress: () => {
              setSplitListAmountDisplayDraft(option.key);
              setSplitListAmountDisplayMenuOpen(false);
            },
          }))}
          onDismiss={() => setSplitListAmountDisplayMenuOpen(false)}
        />
      ) : null}
      {currencyModalOpen ? (
        <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
          <View style={screenStyles.splitNoticeBackdrop} />
          <View style={screenStyles.splitNoticeCard}>
            <YStack gap="$3">
              <Text
                fontFamily={FONTS.headlineBold}
                fontSize={22}
                color={PALETTE.onSurface}
              >
                {t("settings.currencyAddTitle")}
              </Text>
              <View
                style={[
                  screenStyles.assignInputShell,
                  customCurrencyErrors.name
                    ? screenStyles.assignInputShellError
                    : null,
                ]}
              >
                <TextInput
                  value={customCurrencyName}
                  onChangeText={(value) => {
                    setCustomCurrencyName(value.slice(0, 15));
                    if (customCurrencyErrors.name) {
                      setCustomCurrencyErrors((current) => ({
                        ...current,
                        name: false,
                      }));
                    }
                  }}
                  placeholder={t("settings.currencyNamePlaceholder")}
                  placeholderTextColor={PALETTE.inputPlaceholder}
                  style={screenStyles.assignInput}
                  returnKeyType="next"
                  onSubmitEditing={() =>
                    customCurrencySymbolInputRef.current?.focus()
                  }
                  maxLength={15}
                />
              </View>
              <View
                style={[
                  screenStyles.assignInputShell,
                  customCurrencyErrors.symbol
                    ? screenStyles.assignInputShellError
                    : null,
                ]}
              >
                <TextInput
                  ref={customCurrencySymbolInputRef}
                  value={customCurrencySymbol}
                  onChangeText={(value) => {
                    setCustomCurrencySymbol(value.slice(0, 3));
                    if (customCurrencyErrors.symbol) {
                      setCustomCurrencyErrors((current) => ({
                        ...current,
                        symbol: false,
                      }));
                    }
                  }}
                  placeholder={t("settings.currencySymbolPlaceholder")}
                  placeholderTextColor={PALETTE.inputPlaceholder}
                  style={screenStyles.assignInput}
                  returnKeyType="done"
                  onSubmitEditing={() => void addCustomCurrency()}
                  maxLength={3}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("settings.currencySave")}
                style={screenStyles.splitNoticeButton}
                onPress={() => void addCustomCurrency()}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={14}
                  color={PALETTE.onPrimary}
                >
                  {t("settings.currencySave")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
                style={screenStyles.confirmChoiceSecondaryButton}
                onPress={closeCustomCurrencyModal}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={14}
                  color={PALETTE.onSurfaceVariant}
                >
                  {t("common.cancel")}
                </Text>
              </Pressable>
            </YStack>
          </View>
        </View>
      ) : null}
      {pendingTabChange ? (
        <ConfirmChoiceModal
          title={t("settings.confirmSave.title")}
          body={t("settings.confirmSave.body")}
          confirmLabel={t("settings.confirmSave.confirm")}
          discardLabel={t("settings.confirmSave.discard")}
          onConfirm={onConfirmPendingTabChange}
          onDiscard={onDiscardPendingTabChange}
        />
      ) : null}
    </>
  );
}
