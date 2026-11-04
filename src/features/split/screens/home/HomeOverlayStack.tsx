import { useRef, type RefObject } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Bell, Pencil, Trash2 } from "lucide-react-native";
import { Text as TamaguiText, YStack as TamaguiYStack } from "tamagui";

import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import {
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
import { SplitDetailsQuickEditModal } from "./SplitDetailsQuickEditModal";
import { BottomActionSheet } from "../shared/BottomActionSheet";
import { FormBottomSheet, FormSheetFooter } from "../shared/FormBottomSheet";
import { ActionListSheet } from "../shared/ActionListSheet";
import type { SplitTag, SplitTagColor, SplitTagIcon } from "../../tags";

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
  selectedRecordHasReminder,
  selectedRecordReminderDate,
  onDismissRecordActionTarget,
  onRecordActionReminder,
  onRecordActionEditDetails,
  onRecordActionDelete,
  quickEditRecord,
  tags,
  onCancelQuickEdit,
  onSaveQuickEdit,
  onAddQuickEditTag,
  splitReminderPickerRecord,
  splitReminderPickerHasExisting,
  splitReminderErrorMessage,
  onClearSplitReminderError,
  onCancelSplitReminder,
  onRemoveSplitReminder,
  onSaveSplitReminder,
  reminderToastMessage,
  reminderUndoAvailable,
  onUndoReminderRemoval,
  footerInsetBottom,
  safeAreaBottomInset,
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
}: {
  settingsNoticeTitle: string;
  settingsNoticeMessages: string[];
  onDismissSettingsNotice: () => void;
  selectedRecordActionTarget: RecordActionTarget | null;
  selectedRecordHasReminder: boolean;
  selectedRecordReminderDate?: string;
  onDismissRecordActionTarget: () => void;
  onRecordActionReminder: () => void;
  onRecordActionEditDetails: () => void;
  onRecordActionDelete: () => void;
  quickEditRecord: HomeRecord | undefined;
  tags: SplitTag[];
  onCancelQuickEdit: () => void;
  onSaveQuickEdit: (details: {
    splitName: string;
    tagIds: string[];
  }) => Promise<void>;
  onAddQuickEditTag: (
    label: string,
    icon?: SplitTagIcon | null,
    color?: SplitTagColor,
  ) => Promise<boolean>;
  splitReminderPickerRecord: HomeRecord | undefined;
  splitReminderPickerHasExisting: boolean;
  splitReminderErrorMessage: string;
  onClearSplitReminderError: () => void;
  onCancelSplitReminder: () => void;
  onRemoveSplitReminder: () => void;
  onSaveSplitReminder: (scheduledForIso: string) => void;
  reminderToastMessage: string;
  reminderUndoAvailable: boolean;
  onUndoReminderRemoval: () => void;
  footerInsetBottom: number;
  safeAreaBottomInset: number;
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
}) {
  const { t } = useTranslation();
  const openCurrencyAfterDismiss = useRef(false);
  const deferredAction = useRef<(() => void) | null>(null);
  const deferAction = (action: () => void) => {
    deferredAction.current = action;
    onDismissRecordActionTarget();
  };

  return (
    <>
      {!currencyModalOpen ? <SplitNoticeModal
        title={settingsNoticeTitle}
        messages={settingsNoticeMessages}
        onDismiss={onDismissSettingsNotice}
      /> : null}
      <ActionListSheet
          visible={Boolean(selectedRecordActionTarget)}
          title={t("home.rowActions.title")}
          cancelLabel={t("common.cancel")}
          bottomInset={safeAreaBottomInset}
          options={[
            {
              label: t("home.rowActions.editDetails"),
              accessibilityLabel: t("home.rowActions.editDetailsA11y", {
                title: selectedRecordActionTarget?.title ?? "",
              }),
              icon: <Pencil color={PALETTE.primary} size={18} />,
              description: t("home.editDetails.description"),
              onPress: () => deferAction(onRecordActionEditDetails),
            },
            {
              label: t(selectedRecordHasReminder ? "reminders.actionEdit" : "reminders.actionSet"),
              icon: <Bell color={PALETTE.primary} size={18} />,
              description: selectedRecordReminderDate ?? t("home.rowActions.reminderDescription"),
              onPress: () => deferAction(onRecordActionReminder),
            },
            {
              label: t("home.rowActions.delete"),
              accessibilityLabel: t("home.rowActions.deleteA11y", {
                title: selectedRecordActionTarget?.title ?? "",
              }),
              icon: <Trash2 color={PALETTE.danger} size={18} />,
              tone: "danger",
              onPress: () => deferAction(onRecordActionDelete),
            },
          ]}
          onDismiss={onDismissRecordActionTarget}
          onDismissComplete={() => {
            onDismissRecordActionTarget();
            const action = deferredAction.current;
            deferredAction.current = null;
            action?.();
          }}
        />
      {quickEditRecord ? (
        <SplitDetailsQuickEditModal
          record={quickEditRecord}
          tags={tags}
          onCancel={onCancelQuickEdit}
          onSave={onSaveQuickEdit}
          onAddTag={onAddQuickEditTag}
        />
      ) : null}
      {splitReminderPickerRecord ? (
        <ReminderDateTimeModal
          title={t(splitReminderPickerHasExisting ? "reminders.picker.editTitle" : "reminders.picker.setTitle")}
          initialIso={
            splitReminderPickerRecord.reminderState?.splitReminder
              ?.scheduledForIso
          }
          saveLabel={
            splitReminderPickerHasExisting
              ? t("reminders.update")
              : t("reminders.set")
          }
          errorMessage={splitReminderErrorMessage}
          onClearError={onClearSplitReminderError}
          onCancel={onCancelSplitReminder}
          onRemove={
            splitReminderPickerHasExisting ? onRemoveSplitReminder : undefined
          }
          onSave={onSaveSplitReminder}
        />
      ) : null}
      <ToastNotice
        message={reminderToastMessage}
        bottomOffset={footerInsetBottom + 12}
        actionLabel={reminderUndoAvailable ? t("common.undo") : undefined}
        onAction={reminderUndoAvailable ? onUndoReminderRemoval : undefined}
      />
      <BottomActionSheet
          visible={currencyMenuOpen}

          selectionMode
          cancelLabel={t("common.cancel")}
          bottomInset={safeAreaBottomInset}
          title={t("settings.defaultCurrency")}
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
                openCurrencyAfterDismiss.current = true;
                setCurrencyMenuOpen(false);
              },
            },
          ]}
          onDismiss={() => setCurrencyMenuOpen(false)}
          onDismissComplete={() => { if (openCurrencyAfterDismiss.current) { openCurrencyAfterDismiss.current = false; setCurrencyModalOpen(true); } }}
        />
      <BottomActionSheet
          visible={languageMenuOpen}

          selectionMode
          cancelLabel={t("common.cancel")}
          bottomInset={safeAreaBottomInset}
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
      <BottomActionSheet
          visible={humourMenuOpen}

          selectionMode
          cancelLabel={t("common.cancel")}
          bottomInset={safeAreaBottomInset}
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
      <BottomActionSheet
          visible={splitListAmountDisplayMenuOpen}

          selectionMode
          cancelLabel={t("common.cancel")}
          bottomInset={safeAreaBottomInset}
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
      {currencyModalOpen ? (
        <FormBottomSheet title={t("settings.currencyAddTitle")} onClose={closeCustomCurrencyModal} avoidKeyboard>
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            <YStack gap="$3">
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
              {settingsNoticeMessages.length > 0 ? <YStack gap="$2">
                <Text fontFamily={FONTS.headlineBold} color={PALETTE.onSurface}>{settingsNoticeTitle}</Text>
                {settingsNoticeMessages.map((message) => <Text key={message} color={PALETTE.onSurfaceVariant}>{message}</Text>)}
                <Pressable accessibilityRole="button" accessibilityLabel={t("modal.dismissNotice")} onPress={onDismissSettingsNotice} style={screenStyles.formSheetCancel}><Text color={PALETTE.primary}>{t("common.ok")}</Text></Pressable>
              </YStack> : null}
              <FormSheetFooter primaryLabel={t("settings.currencySave")} onPrimaryPress={() => void addCustomCurrency()} cancelLabel={t("common.cancel")} onCancel={closeCustomCurrencyModal} />
            </YStack>
          </ScrollView>
        </FormBottomSheet>
      ) : null}
    </>
  );
}
