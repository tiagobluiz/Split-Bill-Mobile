import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { useShallow } from "zustand/react/shallow";
import {
  ArrowLeft,
  AlertTriangle,
  ChevronDown,
  Camera,
  Check,
  ClipboardCopy,
  Equal,
  FileJson,
  Filter,
  Hash,
  Home,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  Settings,
  Share2,
  Trash2,
  X,
} from "lucide-react-native";
import {
  Paragraph as TamaguiParagraph,
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  AppScreen,
  AvatarBadge,
  EmptyState,
  FieldLabel,
  FloatingFooter,
  HeroCard,
  PrimaryButton,
  QuietButton,
  ScreenHeader,
  SecondaryButton,
  SectionCard,
  SectionEyebrow,
  SoftInput,
  StatPill,
} from "../../../../components/ui";
import {
  buildShareSummary,
  computeSettlement,
  createEmptyItem,
  createId,
  formatMoney,
  normalizeMoneyInput,
  parseMoneyToCents,
  resetPercentAllocations,
  resetShareAllocations,
  validateStepOne,
  validateStepTwo,
  validateStepThree,
} from "../../../../domain";
import type { ParticipantFormValue } from "../../../../domain/splitter";
import { getDeviceLocale } from "../../../../lib/device";
import { fetchExchangeRate } from "../../../../lib/exchangeRates";
import type { DraftRecord } from "../../../../storage/records";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import {
  getClipboardSummaryPreview,
  getPdfExportPreview,
  getSettlementPreview,
  useSplitStore,
} from "../../store";
import {
  getAvatarTone,
  getCurrencyOptionLabel,
  getCurrencyOptions,
  getFrequentFriends,
  getInitials,
  getParticipantDisplayName,
  getParticipantsStepErrors,
  isOwnerReference,
} from "../shared/participantUtils";
import {
  buildRecordRoute,
  cloneAllocations,
  cloneItem,
  formatPercentValue,
  getAssignedParticipantCount,
  getDraftPendingStep,
  getFriendlySplitMessage,
  getItemCategoryLabel,
  getNextPendingSplitItem,
  getNextPendingSplitItemId,
  getPercentInputMessage,
  getRecordTitle,
  hasTrailingPercentSeparator,
  isItemAssigned,
  isVisibleItem,
  normalizeCommittedPercentValue,
  normalizePercentInput,
  rebalanceEditablePercentAllocations,
} from "../shared/recordUtils";
import {
  formatAppMoney,
  getHomeBalanceCards,
  getOverviewSettlementLabel,
  getOwingPeople,
  getRecentRowMeta,
  getSettledParticipantIds,
} from "../shared/settlementUtils";
import {
  ErrorList,
  FlowContinueButton,
  ModePills,
  ModeToggle,
} from "../shared/components";
import { HomeTabBar, RecordRow, type HomeTabKey } from "../shared/homeParts";
import {
  ActionSheetModal,
  ConfirmChoiceModal,
  SplitNoticeModal,
} from "../shared/modals";
import {
  ParticipantAvatar,
  ParticipantRow,
} from "../shared/participantComponents";
import { FlowScreenHeader } from "../shared/flowComponents";
import { useRecord } from "../shared/hooks";
import { screenStyles } from "../shared/styles";

const Paragraph = TamaguiParagraph as any;
const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

const MAX_SPLIT_NAME_LENGTH = 20;
const MAX_ITEM_NAME_LENGTH = 25;
const ITEM_CATEGORY_OPTIONS = [
  "General",
  "Produce",
  "Bakery",
  "Dairy",
  "Pantry",
  "Drinks",
  "Main",
  "Entree",
  "Side",
  "Dessert",
  "Service",
  "Museum",
  "Tickets",
] as const;
export function SetupScreenView({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const record = useRecord(draftId);
  const { updateDraftMeta, setStep, settings } = useSplitStore(
    useShallow((state) => ({
      updateDraftMeta: state.updateDraftMeta,
      setStep: state.setStep,
      settings: state.settings,
    })),
  );
  const insets = useSafeAreaInsets();
  const [splitName, setSplitName] = useState(record?.values.splitName ?? "");
  const [currency, setCurrency] = useState(
    record?.values.currency ?? settings.defaultCurrency,
  );
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [rateInput, setRateInput] = useState(
    String(record?.values.exchangeRate?.rate ?? 1),
  );
  const [rateSource, setRateSource] = useState<"auto" | "manual" | "fallback">(
    record?.values.exchangeRate?.rateSource ?? "fallback",
  );
  const [loadingRate, setLoadingRate] = useState(false);
  const [manualRateOverride, setManualRateOverride] = useState(false);
  const [autoFetchedPair, setAutoFetchedPair] = useState("");
  const [rateByPair, setRateByPair] = useState<
    Record<
      string,
      {
        rate: number;
        rateSource: "auto" | "manual" | "fallback";
        rateUpdatedAt?: string;
      }
    >
  >({});
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(
    record?.values.exchangeRate?.rateUpdatedAt ?? null,
  );
  const [showRateConfirmModal, setShowRateConfirmModal] = useState(false);
  const [setupNoticeMessages, setSetupNoticeMessages] = useState<string[]>([]);
  useEffect(() => {
    if (record) {
      setSplitName(record.values.splitName ?? "");
      setCurrency(record.values.currency ?? settings.defaultCurrency);
      setRateInput(String(record.values.exchangeRate?.rate ?? 1));
      setRateSource(record.values.exchangeRate?.rateSource ?? "fallback");
      setManualRateOverride(record.values.exchangeRate?.rateSource === "manual");
      setAutoFetchedPair("");
      setRateUpdatedAt(record.values.exchangeRate?.rateUpdatedAt ?? null);
      const source = (record.values.currency ?? settings.defaultCurrency)
        .trim()
        .toUpperCase();
      const target = settings.defaultCurrency.trim().toUpperCase();
      const pairKey = `${source}->${target}`;
      setRateByPair(
        record.values.exchangeRate
          ? {
              [pairKey]: {
                rate: record.values.exchangeRate.rate,
                rateSource: record.values.exchangeRate.rateSource ?? "fallback",
                rateUpdatedAt: record.values.exchangeRate.rateUpdatedAt,
              },
            }
          : {},
      );
      setCurrencyMenuOpen(false);
      setSetupNoticeMessages([]);
    }
  }, [record, settings.defaultCurrency]);
  const currencyOptions = [
    ...getCurrencyOptions(settings),
    ...(!getCurrencyOptions(settings).some(
      (option) => option.code === settings.defaultCurrency,
    )
      ? [
          {
            code: settings.defaultCurrency,
            label: getCurrencyOptionLabel(settings.defaultCurrency, settings),
          },
        ]
      : []),
  ];
  const normalizedCurrency = currency.trim().toUpperCase();
  const normalizedTargetCurrency = settings.defaultCurrency.trim().toUpperCase();
  const parsedRate = Number(rateInput.replace(",", "."));
  const effectiveRate =
    Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 1;
  const needsConversion = normalizedCurrency !== normalizedTargetCurrency;
  const canContinue = Boolean(normalizedCurrency);
  const fetchLiveRate = async () => {
    if (!needsConversion) {
      return;
    }
    setLoadingRate(true);
    const result = await fetchExchangeRate(
      normalizedCurrency,
      normalizedTargetCurrency,
    );
    setLoadingRate(false);
    setRateInput(String(result.rate));
    setRateSource(result.source);
    const updatedAt = new Date().toISOString();
    setRateUpdatedAt(updatedAt);
    setAutoFetchedPair(`${normalizedCurrency}->${normalizedTargetCurrency}`);
    setRateByPair((prev) => ({
      ...prev,
      [`${normalizedCurrency}->${normalizedTargetCurrency}`]: {
        rate: result.rate,
        rateSource: result.source,
        rateUpdatedAt: updatedAt,
      },
    }));
  };

  useEffect(() => {
    const pairKey = `${normalizedCurrency}->${normalizedTargetCurrency}`;
    const savedPairRate = rateByPair[pairKey];
    if (!savedPairRate) {
      setRateInput("1");
      setRateSource("fallback");
      setManualRateOverride(false);
      setRateUpdatedAt(null);
      return;
    }
    setRateInput(String(savedPairRate.rate));
    setRateSource(savedPairRate.rateSource);
    setManualRateOverride(savedPairRate.rateSource === "manual");
    setRateUpdatedAt(savedPairRate.rateUpdatedAt ?? null);
  }, [normalizedCurrency, normalizedTargetCurrency, rateByPair]);

  useEffect(() => {
    if (!record || !needsConversion || !normalizedCurrency) {
      return;
    }
    if (manualRateOverride) {
      return;
    }
    const pair = `${normalizedCurrency}->${normalizedTargetCurrency}`;
    if (pair === autoFetchedPair) {
      return;
    }
    const savedRate = record.values.exchangeRate;
    const savedSource = savedRate?.sourceCurrency?.trim().toUpperCase();
    const savedTarget = savedRate?.targetCurrency?.trim().toUpperCase();
    if (savedRate && savedSource === normalizedCurrency && savedTarget === normalizedTargetCurrency) {
      return;
    }
    void fetchLiveRate();
  }, [record, normalizedCurrency, normalizedTargetCurrency, needsConversion, manualRateOverride, autoFetchedPair]);

  if (!record) {
    return (
      <AppScreen scroll={false}>
        <EmptyState
          title={t("common.loadingSplitTitle")}
          description={t("common.loadingSplitDescription")}
        />
      </AppScreen>
    );
  }

  const persistAndContinue = async () => {
    await updateDraftMeta(
      splitName.trim().slice(0, MAX_SPLIT_NAME_LENGTH),
      normalizedCurrency,
      needsConversion
        ? {
            sourceCurrency: normalizedCurrency,
            targetCurrency: normalizedTargetCurrency,
            rate: effectiveRate,
            rateSource,
            rateUpdatedAt: rateUpdatedAt ?? new Date().toISOString(),
          }
        : undefined,
    );
    await setStep(2);
    router.push(`/split/${draftId}/participants`);
  };

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <FlowContinueButton
            accessibilityLabel={t("flow.setup.nextA11y")}
            disabled={!canContinue}
            label={t("flow.setup.next", undefined, { maxLength: 26 })}
            onPress={async () => {
              if (!canContinue) {
                return;
              }
              if (!splitName.trim()) {
                setSetupNoticeMessages([
                  t("flow.setup.nameRequired"),
                ]);
                return;
              }
              if (needsConversion && effectiveRate === 1) {
                setShowRateConfirmModal(true);
                return;
              }
              await persistAndContinue();
            }}
          />
        </FloatingFooter>
      }
    >
      <View
        style={[
          screenStyles.stickyFlowHeader,
          { paddingTop: Math.max(insets.top + 10, 28) },
        ]}
      >
        <FlowScreenHeader
          title={t("flow.setup.title", undefined, { maxLength: 16 })}
          onBack={() => router.replace("/")}
        />
      </View>
      <ScrollView
        style={screenStyles.flex}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          { paddingBottom: 172 + Math.max(insets.bottom, 14) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
          <YStack gap="$4">
            <YStack gap="$2">
              <FieldLabel>{t("flow.setup.splitName")}</FieldLabel>
              <View style={screenStyles.assignInputShell}>
                <TextInput
                  accessibilityLabel={t("flow.setup.splitName")}
                  value={splitName}
                  onChangeText={(value) => {
                    setSplitName(value.slice(0, MAX_SPLIT_NAME_LENGTH));
                    if (setupNoticeMessages.length > 0) {
                      setSetupNoticeMessages([]);
                    }
                  }}
                  placeholder={t("flow.setup.splitNamePlaceholder")}
                  placeholderTextColor={PALETTE.inputPlaceholder}
                  style={screenStyles.assignInput}
                  maxLength={MAX_SPLIT_NAME_LENGTH}
                />
              </View>
            </YStack>
            <YStack gap="$2">
              <FieldLabel>{t("flow.setup.currency")}</FieldLabel>
              <YStack gap="$2.5">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("flow.setup.currency")}
                  style={screenStyles.selectRow}
                  onPress={() => setCurrencyMenuOpen((value) => !value)}
                >
                  <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <Text
                      fontFamily={FONTS.bodyMedium}
                      fontSize={17}
                      color={PALETTE.onSurface}
                    >
                      {getCurrencyOptionLabel(
                        normalizedCurrency || settings.defaultCurrency,
                        settings,
                      )}
                    </Text>
                    <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
                  </XStack>
                </Pressable>
              </YStack>
            </YStack>
            {needsConversion ? (
              <YStack gap="$2">
                <FieldLabel>
                  {t("flow.setup.exchangeRateToCurrency", {
                    currency: normalizedTargetCurrency,
                  })}
                </FieldLabel>
                <View style={screenStyles.assignInputShell}>
                  <XStack alignItems="center" gap="$2">
                    <View style={{ flex: 1 }}>
                      <TextInput
                        accessibilityLabel="Exchange rate"
                        value={rateInput}
                        onChangeText={(value) => {
                          const numericValue = Number(value.replace(",", "."));
                          setRateInput(value);
                          setRateSource("manual");
                          setManualRateOverride(true);
                          if (Number.isFinite(numericValue) && numericValue > 0) {
                            const updatedAt = new Date().toISOString();
                            setRateUpdatedAt(updatedAt);
                            setRateByPair((prev) => ({
                              ...prev,
                              [`${normalizedCurrency}->${normalizedTargetCurrency}`]: {
                                rate: numericValue,
                                rateSource: "manual",
                                rateUpdatedAt: updatedAt,
                              },
                            }));
                          }
                        }}
                        placeholder="1.00"
                        placeholderTextColor={PALETTE.inputPlaceholder}
                        keyboardType="decimal-pad"
                        style={screenStyles.assignInput}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Refresh exchange rate"
                      onPress={() => {
                        setManualRateOverride(false);
                        void fetchLiveRate();
                      }}
                      style={[
                        screenStyles.iconButton,
                        {
                          width: 46,
                          height: 46,
                          borderRadius: 14,
                          backgroundColor: loadingRate ? PALETTE.surfaceContainerHigh : PALETTE.primary,
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      ]}
                    >
                      {loadingRate ? (
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={18}
                          color={PALETTE.onPrimary}
                        >
                          ...
                        </Text>
                      ) : (
                        <RotateCcw size={20} color={PALETTE.onPrimary} />
                      )}
                    </Pressable>
                  </XStack>
                </View>
                {rateUpdatedAt ? (
                  <Text
                    fontFamily={FONTS.bodyMedium}
                    fontSize={12}
                    color={PALETTE.onSurfaceVariant}
                  >
                    {t("flow.setup.exchangeRateUpdatedAt", {
                      date: new Date(rateUpdatedAt).toLocaleString(),
                    })}
                  </Text>
                ) : null}
              </YStack>
            ) : null}
          </YStack>
        </YStack>
      </ScrollView>
      <SplitNoticeModal
        messages={setupNoticeMessages}
        onDismiss={() => setSetupNoticeMessages([])}
      />
      {currencyMenuOpen ? (
        <ActionSheetModal
          title={t("flow.setup.currency")}
          options={currencyOptions.map((option) => ({
            label: option.label,
            selected: normalizedCurrency === option.code,
            onPress: () => {
              setCurrency(option.code);
              setAutoFetchedPair("");
              setCurrencyMenuOpen(false);
            },
          }))}
          onDismiss={() => setCurrencyMenuOpen(false)}
        />
      ) : null}
      {showRateConfirmModal ? (
        <ConfirmChoiceModal
          title="Exchange rate is 1"
          body="This is uncommon for different currencies. Confirm if this is intentional."
          confirmLabel="Continue"
          discardLabel="Edit rate"
          onConfirm={() => {
            setShowRateConfirmModal(false);
            void persistAndContinue();
          }}
          onDiscard={() => setShowRateConfirmModal(false)}
        />
      ) : null}
    </AppScreen>
  );
}
