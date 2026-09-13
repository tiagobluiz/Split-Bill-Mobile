import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { createId } from "../../../../domain";
import { type AppHumour, type AppLanguage } from "../../../../i18n";
import { useTranslation } from "../../../../i18n/provider";
import type {
  AppSettings,
  SplitListAmountDisplay,
} from "../../../../storage/settings";
import { getCurrencyOptions } from "../shared/participantUtils";
import type {
  SelectableSplitListAmountDisplayOption,
  SplitListAmountDisplayOption,
} from "./homeTypes";

export const MAX_OWNER_NAME_LENGTH = 12;
const MAX_CUSTOM_CURRENCY_SUFFIX = 999;
const OWNER_NAME_AUTOSAVE_DELAY_MS = 450;

function normalizeCustomCurrencyCodeCandidate(value: string) {
  return (
    value
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 3) || "CUR"
  );
}

function findAvailableCurrencyCodeFromBase(
  baseCode: string,
  existingCodes: Set<string>,
) {
  if (!existingCodes.has(baseCode)) {
    return baseCode;
  }

  for (let suffix = 2; suffix <= MAX_CUSTOM_CURRENCY_SUFFIX; suffix += 1) {
    const suffixToken = String(suffix);
    const candidate = `${baseCode.slice(0, Math.max(0, 3 - suffixToken.length))}${suffixToken}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function findAlphabeticCurrencyCodeFallback(existingCodes: Set<string>) {
  for (let index = 0; index < 26 ** 3; index += 1) {
    const first = String.fromCharCode(65 + Math.floor(index / (26 * 26)));
    const second = String.fromCharCode(65 + (Math.floor(index / 26) % 26));
    const third = String.fromCharCode(65 + (index % 26));
    const candidate = `${first}${second}${third}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

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

type PersistableSettings = Pick<
  AppSettings,
  | "ownerName"
  | "ownerProfileImageUri"
  | "balanceFeatureEnabled"
  | "trackPaymentsFeatureEnabled"
  | "defaultCurrency"
  | "language"
  | "humour"
  | "splitListAmountDisplay"
  | "customCurrencies"
>;

type UseHomeSettingsDraftControllerParams = {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
};

export function useHomeSettingsDraftController({
  settings,
  updateSettings,
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
  const ownerNameDraftRef = useRef(ownerNameDraft);
  const ownerProfileImageUriDraftRef = useRef(ownerProfileImageUriDraft);
  const balanceFeatureEnabledDraftRef = useRef(balanceFeatureEnabledDraft);
  const trackPaymentsFeatureEnabledDraftRef = useRef(
    trackPaymentsFeatureEnabledDraft,
  );
  const defaultCurrencyDraftRef = useRef(defaultCurrencyDraft);
  const languageDraftRef = useRef(languageDraft);
  const humourDraftRef = useRef(humourDraft);
  const splitListAmountDisplayDraftRef = useRef(splitListAmountDisplayDraft);
  const customCurrenciesDraftRef = useRef(customCurrenciesDraft);

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

  const clearSettingsNotice = useCallback(() => {
    setSettingsNoticeTitle(t("common.almostThere"));
    setSettingsNoticeMessages([]);
  }, [t]);

  const showSaveFailure = useCallback(
    (error: unknown) => {
      setSettingsNoticeTitle(t("common.couldNotSaveSettings"));
      setSettingsNoticeMessages([
        error instanceof Error && error.message
          ? error.message
          : t("common.tryAgain"),
      ]);
    },
    [t],
  );

  const persistSettings = useCallback(
    async (overrides: Partial<PersistableSettings>) => {
      const nextOwnerName = overrides.ownerName ?? ownerNameDraftRef.current;
      const nextDefaultCurrency =
        overrides.defaultCurrency ??
        defaultCurrencyDraftRef.current.trim().toUpperCase();
      const nextBalance =
        overrides.balanceFeatureEnabled ??
        balanceFeatureEnabledDraftRef.current;
      const nextSplitRows =
        overrides.splitListAmountDisplay ??
        splitListAmountDisplayDraftRef.current;
      const persistedSplitListAmountDisplay =
        !nextBalance && isBalanceDependentSplitListAmountDisplay(nextSplitRows)
          ? "total"
          : nextSplitRows;

      if (!nextOwnerName.trim()) {
        setSettingsNoticeTitle(t("common.almostThere"));
        setSettingsNoticeMessages([t("settings.ownerNameRequired")]);
        return false;
      }

      if (!nextDefaultCurrency.trim()) {
        setSettingsNoticeTitle(t("common.almostThere"));
        setSettingsNoticeMessages([t("settings.defaultCurrencyRequired")]);
        return false;
      }

      try {
        await updateSettings({
          ownerName: nextOwnerName.trim(),
          ownerProfileImageUri:
            overrides.ownerProfileImageUri ??
            ownerProfileImageUriDraftRef.current.trim(),
          balanceFeatureEnabled: nextBalance,
          trackPaymentsFeatureEnabled:
            overrides.trackPaymentsFeatureEnabled ??
            trackPaymentsFeatureEnabledDraftRef.current,
          defaultCurrency: nextDefaultCurrency.trim().toUpperCase(),
          language: overrides.language ?? languageDraftRef.current,
          humour: overrides.humour ?? humourDraftRef.current,
          splitListAmountDisplay: persistedSplitListAmountDisplay,
          customCurrencies:
            overrides.customCurrencies ?? customCurrenciesDraftRef.current,
        });
        clearSettingsNotice();
        return true;
      } catch (error) {
        showSaveFailure(error);
        return false;
      }
    },
    [clearSettingsNotice, showSaveFailure, t, updateSettings],
  );

  useEffect(() => {
    setOwnerNameDraft(settings.ownerName ?? "");
    ownerNameDraftRef.current = settings.ownerName ?? "";
    setOwnerProfileImageUriDraft(settings.ownerProfileImageUri ?? "");
    ownerProfileImageUriDraftRef.current = settings.ownerProfileImageUri ?? "";
    setBalanceFeatureEnabledDraft(settings.balanceFeatureEnabled ?? true);
    balanceFeatureEnabledDraftRef.current =
      settings.balanceFeatureEnabled ?? true;
    setTrackPaymentsFeatureEnabledDraft(
      settings.trackPaymentsFeatureEnabled ?? true,
    );
    trackPaymentsFeatureEnabledDraftRef.current =
      settings.trackPaymentsFeatureEnabled ?? true;
    setDefaultCurrencyDraft(settings.defaultCurrency ?? "");
    defaultCurrencyDraftRef.current = settings.defaultCurrency ?? "";
    setLanguageDraft(settings.language ?? "en");
    languageDraftRef.current = settings.language ?? "en";
    setHumourDraft(settings.humour ?? "plain");
    humourDraftRef.current = settings.humour ?? "plain";
    const normalizedSplitRows = normalizeSplitListAmountDisplaySetting(
      settings.splitListAmountDisplay,
      settings.balanceFeatureEnabled,
    );
    setSplitListAmountDisplayDraft(normalizedSplitRows);
    splitListAmountDisplayDraftRef.current = normalizedSplitRows;
    setCustomCurrenciesDraft(settings.customCurrencies ?? []);
    customCurrenciesDraftRef.current = settings.customCurrencies ?? [];
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmedName = ownerNameDraft.trim();
      if (!trimmedName) {
        return;
      }
      if (trimmedName === (settings.ownerName ?? "")) {
        return;
      }
      void persistSettings({ ownerName: trimmedName });
    }, OWNER_NAME_AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [ownerNameDraft, persistSettings, settings.ownerName, t]);

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

  const setOwnerNameDraftAndSave = (value: string) => {
    ownerNameDraftRef.current = value;
    setOwnerNameDraft(value);
    if (value.trim()) {
      clearSettingsNotice();
    }
  };

  const validateOwnerNameDraft = () => {
    if (ownerNameDraftRef.current.trim()) {
      return true;
    }
    setSettingsNoticeTitle(t("common.almostThere"));
    setSettingsNoticeMessages([t("settings.ownerNameRequired")]);
    return false;
  };

  const setOwnerProfileImageUriDraftAndSave = (value: string) => {
    const nextValue = value.trim();
    ownerProfileImageUriDraftRef.current = nextValue;
    setOwnerProfileImageUriDraft(nextValue);
    void persistSettings({ ownerProfileImageUri: nextValue });
  };

  const setBalanceFeatureEnabledDraftAndSave = (
    value: boolean | ((value: boolean) => boolean),
  ) => {
    const nextBalance =
      typeof value === "function"
        ? value(balanceFeatureEnabledDraftRef.current)
        : value;
    const nextTrackPayments = nextBalance
      ? true
      : trackPaymentsFeatureEnabledDraftRef.current;
    const nextSplitRows =
      !nextBalance &&
      isBalanceDependentSplitListAmountDisplay(
        splitListAmountDisplayDraftRef.current,
      )
        ? "total"
        : splitListAmountDisplayDraftRef.current;
    balanceFeatureEnabledDraftRef.current = nextBalance;
    trackPaymentsFeatureEnabledDraftRef.current = nextTrackPayments;
    splitListAmountDisplayDraftRef.current = nextSplitRows;
    setBalanceFeatureEnabledDraft(nextBalance);
    setTrackPaymentsFeatureEnabledDraft(nextTrackPayments);
    setSplitListAmountDisplayDraft(nextSplitRows);
    void persistSettings({
      balanceFeatureEnabled: nextBalance,
      trackPaymentsFeatureEnabled: nextTrackPayments,
      splitListAmountDisplay: nextSplitRows,
    });
  };

  const setTrackPaymentsFeatureEnabledDraftAndSave = (
    value: boolean | ((value: boolean) => boolean),
  ) => {
    const nextTrackPayments =
      typeof value === "function"
        ? value(trackPaymentsFeatureEnabledDraftRef.current)
        : value;
    const nextBalance = nextTrackPayments
      ? balanceFeatureEnabledDraftRef.current
      : false;
    const nextSplitRows =
      !nextBalance &&
      isBalanceDependentSplitListAmountDisplay(
        splitListAmountDisplayDraftRef.current,
      )
        ? "total"
        : splitListAmountDisplayDraftRef.current;
    trackPaymentsFeatureEnabledDraftRef.current = nextTrackPayments;
    balanceFeatureEnabledDraftRef.current = nextBalance;
    splitListAmountDisplayDraftRef.current = nextSplitRows;
    setTrackPaymentsFeatureEnabledDraft(nextTrackPayments);
    setBalanceFeatureEnabledDraft(nextBalance);
    setSplitListAmountDisplayDraft(nextSplitRows);
    void persistSettings({
      balanceFeatureEnabled: nextBalance,
      trackPaymentsFeatureEnabled: nextTrackPayments,
      splitListAmountDisplay: nextSplitRows,
    });
  };

  const setDefaultCurrencyDraftAndSave = (value: string) => {
    const nextValue = value.trim().toUpperCase();
    defaultCurrencyDraftRef.current = nextValue;
    setDefaultCurrencyDraft(nextValue);
    setCurrencyMenuOpen(false);
    void persistSettings({ defaultCurrency: nextValue });
  };

  const setLanguageDraftAndSave = (value: AppLanguage) => {
    languageDraftRef.current = value;
    setLanguageDraft(value);
    setLanguageMenuOpen(false);
    void persistSettings({ language: value });
  };

  const setHumourDraftAndSave = (value: AppHumour) => {
    humourDraftRef.current = value;
    setHumourDraft(value);
    setHumourMenuOpen(false);
    void persistSettings({ humour: value });
  };

  const setSplitListAmountDisplayDraftAndSave = (
    value: SplitListAmountDisplay,
  ) => {
    splitListAmountDisplayDraftRef.current = value;
    setSplitListAmountDisplayDraft(value);
    setSplitListAmountDisplayMenuOpen(false);
    void persistSettings({ splitListAmountDisplay: value });
  };

  const canLeaveSettings = () => {
    if (!validateOwnerNameDraft()) {
      return false;
    }

    if (!defaultCurrencyDraftRef.current.trim()) {
      setSettingsNoticeTitle(t("common.almostThere"));
      setSettingsNoticeMessages([t("settings.defaultCurrencyRequired")]);
      return false;
    }

    return true;
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

    setOwnerProfileImageUriDraftAndSave(result.assets[0].uri);
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

    const normalizedCode = normalizeCustomCurrencyCodeCandidate(trimmedName);
    const existingCodes = new Set(
      getCurrencyOptions({ customCurrencies: customCurrenciesDraft }).map(
        (entry) => entry.code,
      ),
    );

    const nextCode =
      findAvailableCurrencyCodeFromBase(normalizedCode, existingCodes) ??
      findAvailableCurrencyCodeFromBase(
        normalizeCustomCurrencyCodeCandidate(createId()),
        existingCodes,
      ) ??
      findAlphabeticCurrencyCodeFallback(existingCodes);

    if (!nextCode) {
      setSettingsNoticeTitle(t("common.almostThere"));
      setSettingsNoticeMessages([
        "Couldn't create a unique currency code. Try a different currency name.",
      ]);
      return;
    }

    const nextCustomCurrencies = [
      ...customCurrenciesDraft,
      { code: nextCode, name: trimmedName, symbol: trimmedSymbol },
    ];
    customCurrenciesDraftRef.current = nextCustomCurrencies;
    defaultCurrencyDraftRef.current = nextCode;
    setCustomCurrenciesDraft(nextCustomCurrencies);
    setDefaultCurrencyDraft(nextCode);
    setCustomCurrencyName("");
    setCustomCurrencySymbol("");
    setCustomCurrencyErrors({ name: false, symbol: false });
    closeCustomCurrencyModal();
    void persistSettings({
      customCurrencies: nextCustomCurrencies,
      defaultCurrency: nextCode,
    });
  };

  return {
    settingsNoticeMessages,
    settingsNoticeTitle,
    ownerNameDraft,
    setOwnerNameDraft: setOwnerNameDraftAndSave,
    validateOwnerNameDraft,
    ownerProfileImageUriDraft,
    setOwnerProfileImageUriDraft: setOwnerProfileImageUriDraftAndSave,
    balanceFeatureEnabledDraft,
    setBalanceFeatureEnabledDraft: setBalanceFeatureEnabledDraftAndSave,
    trackPaymentsFeatureEnabledDraft,
    setTrackPaymentsFeatureEnabledDraft:
      setTrackPaymentsFeatureEnabledDraftAndSave,
    defaultCurrencyDraft,
    setDefaultCurrencyDraft: setDefaultCurrencyDraftAndSave,
    languageDraft,
    setLanguageDraft: setLanguageDraftAndSave,
    humourDraft,
    setHumourDraft: setHumourDraftAndSave,
    splitListAmountDisplayDraft,
    setSplitListAmountDisplayDraft: setSplitListAmountDisplayDraftAndSave,
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
    closeCustomCurrencyModal,
    clearSettingsNotice,
    canLeaveSettings,
    pickProfileImage,
    addCustomCurrency,
  };
}
