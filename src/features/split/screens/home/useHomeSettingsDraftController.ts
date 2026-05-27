import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { createId } from "../../../../domain";
import {
  type AppHumour,
  type AppLanguage,
} from "../../../../i18n";
import { useTranslation } from "../../../../i18n/provider";
import type { AppSettings, SplitListAmountDisplay } from "../../../../storage/settings";
import { getCurrencyOptions } from "../shared/participantUtils";
import type {
  SelectableSplitListAmountDisplayOption,
  SplitListAmountDisplayOption,
} from "./homeTypes";

export const MAX_OWNER_NAME_LENGTH = 12;

export function isBalanceDependentSplitListAmountDisplay(
  value: SplitListAmountDisplay,
) {
  return value === "remaining" || value === "totalAndRemaining";
}

export function normalizeSplitListAmountDisplaySetting(
  value: SplitListAmountDisplay | undefined,
  balanceFeatureEnabled: boolean | undefined,
): SplitListAmountDisplay {
  const resolvedValue = value ?? "remaining";
  if (
    balanceFeatureEnabled === false &&
    isBalanceDependentSplitListAmountDisplay(resolvedValue)
  ) {
    return "total";
  }

  return resolvedValue;
}

type UseHomeSettingsDraftControllerParams = {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onDiscardExtraState: () => void;
};

export function useHomeSettingsDraftController({
  settings,
  updateSettings,
  onDiscardExtraState,
}: UseHomeSettingsDraftControllerParams) {
  const { t } = useTranslation();
  const [settingsNoticeMessages, setSettingsNoticeMessages] = useState<
    string[]
  >([]);
  const [settingsNoticeTitle, setSettingsNoticeTitle] =
    useState("Almost there");
  const [ownerNameDraft, setOwnerNameDraft] = useState(
    settings.ownerName ?? "",
  );
  const [ownerProfileImageUriDraft, setOwnerProfileImageUriDraft] = useState(
    settings.ownerProfileImageUri ?? "",
  );
  const [balanceFeatureEnabledDraft, setBalanceFeatureEnabledDraft] = useState(
    settings.balanceFeatureEnabled ?? true,
  );
  const [
    trackPaymentsFeatureEnabledDraft,
    setTrackPaymentsFeatureEnabledDraft,
  ] = useState(settings.trackPaymentsFeatureEnabled ?? true);
  const [defaultCurrencyDraft, setDefaultCurrencyDraft] = useState(
    settings.defaultCurrency ?? "",
  );
  const [languageDraft, setLanguageDraft] = useState<AppLanguage>(
    settings.language ?? "en",
  );
  const [humourDraft, setHumourDraft] = useState<AppHumour>(
    settings.humour ?? "plain",
  );
  const [splitListAmountDisplayDraft, setSplitListAmountDisplayDraft] =
    useState<SplitListAmountDisplay>(
      normalizeSplitListAmountDisplaySetting(
        settings.splitListAmountDisplay,
        settings.balanceFeatureEnabled,
      ),
    );
  const [customCurrenciesDraft, setCustomCurrenciesDraft] = useState(
    settings.customCurrencies ?? [],
  );
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [humourMenuOpen, setHumourMenuOpen] = useState(false);
  const [splitListAmountDisplayMenuOpen, setSplitListAmountDisplayMenuOpen] =
    useState(false);
  const [profileActionMenuOpen, setProfileActionMenuOpen] = useState(false);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [customCurrencyName, setCustomCurrencyName] = useState("");
  const [customCurrencySymbol, setCustomCurrencySymbol] = useState("");
  const [customCurrencyErrors, setCustomCurrencyErrors] = useState<{
    name: boolean;
    symbol: boolean;
  }>({ name: false, symbol: false });
  const customCurrencySymbolInputRef = useRef<TextInput | null>(null);

  const splitListAmountDisplayOptions: SplitListAmountDisplayOption[] = [
    {
      key: "remaining",
      label: t("settings.splitRows.remaining.label"),
      summary: t("settings.splitRows.remaining.summary"),
      description: t("settings.splitRows.remaining.description"),
    },
    {
      key: "total",
      label: t("settings.splitRows.total.label"),
      summary: t("settings.splitRows.total.summary"),
      description: t("settings.splitRows.total.description"),
    },
    {
      key: "userPaid",
      label: t("settings.splitRows.userPaid.label"),
      summary: t("settings.splitRows.userPaid.summary"),
      description: t("settings.splitRows.userPaid.description"),
    },
    {
      key: "totalAndRemaining",
      label: t("settings.splitRows.totalAndRemaining.label"),
      summary: t("settings.splitRows.totalAndRemaining.summary"),
      description: t("settings.splitRows.totalAndRemaining.description"),
    },
  ];

  const availableSplitListAmountDisplayOptions: SelectableSplitListAmountDisplayOption[] =
    splitListAmountDisplayOptions.map((option) => {
      const disabled =
        !balanceFeatureEnabledDraft &&
        isBalanceDependentSplitListAmountDisplay(option.key);

      return {
        ...option,
        disabled,
        description: disabled
          ? `${option.description} ${t("settings.splitRows.requiresBalanceSuffix")}`
          : option.description,
      };
    });

  const draftCurrencyOptions = getCurrencyOptions({
    customCurrencies: customCurrenciesDraft,
  });

  const normalizedStoredSplitListAmountDisplay =
    normalizeSplitListAmountDisplaySetting(
      settings.splitListAmountDisplay,
      settings.balanceFeatureEnabled,
    );

  const hasLegacySplitListAmountDisplayMismatch =
    (settings.balanceFeatureEnabled ?? true) === false &&
    (settings.splitListAmountDisplay ?? "remaining") !==
      normalizedStoredSplitListAmountDisplay;

  const settingsDirty =
    ownerNameDraft.trim() !== (settings.ownerName ?? "") ||
    ownerProfileImageUriDraft.trim() !==
      (settings.ownerProfileImageUri ?? "") ||
    balanceFeatureEnabledDraft !== (settings.balanceFeatureEnabled ?? true) ||
    trackPaymentsFeatureEnabledDraft !==
      (settings.trackPaymentsFeatureEnabled ?? true) ||
    defaultCurrencyDraft.trim().toUpperCase() !==
      (settings.defaultCurrency ?? "") ||
    languageDraft !== (settings.language ?? "en") ||
    humourDraft !== (settings.humour ?? "plain") ||
    hasLegacySplitListAmountDisplayMismatch ||
    splitListAmountDisplayDraft !== normalizedStoredSplitListAmountDisplay ||
    JSON.stringify(customCurrenciesDraft) !==
      JSON.stringify(settings.customCurrencies ?? []);

  useEffect(() => {
    setOwnerNameDraft(settings.ownerName ?? "");
    setOwnerProfileImageUriDraft(settings.ownerProfileImageUri ?? "");
    setBalanceFeatureEnabledDraft(settings.balanceFeatureEnabled ?? true);
    setTrackPaymentsFeatureEnabledDraft(
      settings.trackPaymentsFeatureEnabled ?? true,
    );
    setDefaultCurrencyDraft(settings.defaultCurrency ?? "");
    setLanguageDraft(settings.language ?? "en");
    setHumourDraft(settings.humour ?? "plain");
    setSplitListAmountDisplayDraft(
      normalizeSplitListAmountDisplaySetting(
        settings.splitListAmountDisplay,
        settings.balanceFeatureEnabled,
      ),
    );
    setCustomCurrenciesDraft(settings.customCurrencies ?? []);
  }, [
    settings.balanceFeatureEnabled,
    settings.trackPaymentsFeatureEnabled,
    settings.customCurrencies,
    settings.defaultCurrency,
    settings.humour,
    settings.language,
    settings.splitListAmountDisplay,
    settings.ownerName,
    settings.ownerProfileImageUri,
  ]);

  const closeCustomCurrencyModal = useCallback(() => {
    setCurrencyModalOpen(false);
    setCustomCurrencyErrors({ name: false, symbol: false });
  }, []);

  useEffect(() => {
    if (!currencyModalOpen && !currencyMenuOpen) {
      return;
    }

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (currencyModalOpen) {
          closeCustomCurrencyModal();
          return true;
        }
        if (currencyMenuOpen) {
          setCurrencyMenuOpen(false);
          return true;
        }
        return false;
      },
    );

    return () => backSubscription.remove();
  }, [closeCustomCurrencyModal, currencyMenuOpen, currencyModalOpen]);

  const clearSettingsNotice = () => {
    setSettingsNoticeTitle(t("common.almostThere"));
    setSettingsNoticeMessages([]);
  };

  const saveSettings = async () => {
    const trimmedName = ownerNameDraft.trim();
    const persistedSplitListAmountDisplay =
      !balanceFeatureEnabledDraft &&
      isBalanceDependentSplitListAmountDisplay(splitListAmountDisplayDraft)
        ? "total"
        : splitListAmountDisplayDraft;

    if (!trimmedName) {
      setSettingsNoticeTitle(t("common.almostThere"));
      setSettingsNoticeMessages([t("settings.ownerNameRequired")]);
      return false;
    }

    if (!defaultCurrencyDraft.trim()) {
      setSettingsNoticeTitle(t("common.almostThere"));
      setSettingsNoticeMessages([t("settings.defaultCurrencyRequired")]);
      return false;
    }

    try {
      await updateSettings({
        ownerName: trimmedName,
        ownerProfileImageUri: ownerProfileImageUriDraft.trim(),
        balanceFeatureEnabled: balanceFeatureEnabledDraft,
        trackPaymentsFeatureEnabled: trackPaymentsFeatureEnabledDraft,
        defaultCurrency: defaultCurrencyDraft.trim().toUpperCase(),
        language: languageDraft,
        humour: humourDraft,
        splitListAmountDisplay: persistedSplitListAmountDisplay,
        customCurrencies: customCurrenciesDraft,
      });

      setCurrencyMenuOpen(false);
      setLanguageMenuOpen(false);
      setHumourMenuOpen(false);
      setSplitListAmountDisplayMenuOpen(false);
      clearSettingsNotice();
      return true;
    } catch (error) {
      setSettingsNoticeTitle(t("common.couldNotSaveSettings"));
      setSettingsNoticeMessages([
        error instanceof Error && error.message
          ? error.message
          : t("common.tryAgain"),
      ]);
      return false;
    }
  };

  const discardSettingsDraft = () => {
    setOwnerNameDraft(settings.ownerName ?? "");
    setOwnerProfileImageUriDraft(settings.ownerProfileImageUri ?? "");
    setBalanceFeatureEnabledDraft(settings.balanceFeatureEnabled ?? true);
    setTrackPaymentsFeatureEnabledDraft(
      settings.trackPaymentsFeatureEnabled ?? true,
    );
    setDefaultCurrencyDraft(settings.defaultCurrency ?? "");
    setLanguageDraft(settings.language ?? "en");
    setHumourDraft(settings.humour ?? "plain");
    setSplitListAmountDisplayDraft(
      normalizeSplitListAmountDisplaySetting(
        settings.splitListAmountDisplay,
        settings.balanceFeatureEnabled,
      ),
    );
    setCustomCurrenciesDraft(settings.customCurrencies ?? []);
    setCustomCurrencyName("");
    setCustomCurrencySymbol("");
    setCurrencyMenuOpen(false);
    setLanguageMenuOpen(false);
    setHumourMenuOpen(false);
    setSplitListAmountDisplayMenuOpen(false);
    setCurrencyModalOpen(false);
    setProfileActionMenuOpen(false);
    setCustomCurrencyErrors({ name: false, symbol: false });
    clearSettingsNotice();
    onDiscardExtraState();
  };

  const pickProfileImage = async (mode: "camera" | "library") => {
    setProfileActionMenuOpen(false);
    const permission =
      mode === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setSettingsNoticeTitle(t("common.almostThere"));
      setSettingsNoticeMessages([
        mode === "camera"
          ? t("settings.profileCameraPermission")
          : t("settings.profileLibraryPermission"),
      ]);
      return;
    }

    const result =
      mode === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    setOwnerProfileImageUriDraft(result.assets[0].uri);
    clearSettingsNotice();
  };

  const addCustomCurrency = async () => {
    const trimmedName = customCurrencyName.trim();
    const trimmedSymbol = customCurrencySymbol.trim();
    const nextErrors = {
      name: !trimmedName || trimmedName.length > 15,
      symbol: !trimmedSymbol || trimmedSymbol.length > 3,
    };
    setCustomCurrencyErrors(nextErrors);

    if (nextErrors.name || nextErrors.symbol) {
      setSettingsNoticeTitle(t("common.almostThere"));
      if (!trimmedName) {
        setSettingsNoticeMessages([t("settings.currencyValidationName")]);
      } else {
        setSettingsNoticeMessages([t("settings.currencyValidationSymbol")]);
      }
      return;
    }

    const normalizedCode =
      trimmedName
        .replace(/[^A-Za-z]/g, "")
        .toUpperCase()
        .slice(0, 3) || "CUR";
    const existingCodes = new Set(
      getCurrencyOptions({ customCurrencies: customCurrenciesDraft }).map(
        (entry) => entry.code,
      ),
    );

    let nextCode = normalizedCode;
    let suffix = 2;
    while (existingCodes.has(nextCode) && suffix <= 999) {
      const suffixToken = String(suffix);
      nextCode = `${normalizedCode.slice(0, Math.max(0, 3 - suffixToken.length))}${suffixToken}`;
      suffix += 1;
    }

    if (existingCodes.has(nextCode)) {
      nextCode =
        createId()
          .replace(/[^A-Za-z0-9]/g, "")
          .toUpperCase()
          .slice(0, 3) || "CUR";
    }

    const nextCustomCurrencies = [
      ...customCurrenciesDraft,
      { code: nextCode, name: trimmedName, symbol: trimmedSymbol },
    ];
    setCustomCurrenciesDraft(nextCustomCurrencies);
    setDefaultCurrencyDraft(nextCode);
    setCustomCurrencyName("");
    setCustomCurrencySymbol("");
    setCustomCurrencyErrors({ name: false, symbol: false });
    closeCustomCurrencyModal();
    clearSettingsNotice();
  };

  return {
    settingsNoticeMessages,
    settingsNoticeTitle,
    ownerNameDraft,
    setOwnerNameDraft,
    ownerProfileImageUriDraft,
    setOwnerProfileImageUriDraft,
    balanceFeatureEnabledDraft,
    setBalanceFeatureEnabledDraft,
    trackPaymentsFeatureEnabledDraft,
    setTrackPaymentsFeatureEnabledDraft,
    defaultCurrencyDraft,
    setDefaultCurrencyDraft,
    languageDraft,
    setLanguageDraft,
    humourDraft,
    setHumourDraft,
    splitListAmountDisplayDraft,
    setSplitListAmountDisplayDraft,
    customCurrenciesDraft,
    setCustomCurrenciesDraft,
    splitListAmountDisplayOptions,
    availableSplitListAmountDisplayOptions,
    currencyMenuOpen,
    setCurrencyMenuOpen,
    languageMenuOpen,
    setLanguageMenuOpen,
    humourMenuOpen,
    setHumourMenuOpen,
    splitListAmountDisplayMenuOpen,
    setSplitListAmountDisplayMenuOpen,
    profileActionMenuOpen,
    setProfileActionMenuOpen,
    currencyModalOpen,
    setCurrencyModalOpen,
    customCurrencyName,
    setCustomCurrencyName,
    customCurrencySymbol,
    setCustomCurrencySymbol,
    customCurrencyErrors,
    setCustomCurrencyErrors,
    customCurrencySymbolInputRef,
    draftCurrencyOptions,
    settingsDirty,
    closeCustomCurrencyModal,
    clearSettingsNotice,
    saveSettings,
    discardSettingsDraft,
    pickProfileImage,
    addCustomCurrency,
  };
}
