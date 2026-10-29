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
import { SplitDatePicker } from "../shared/SplitDatePicker";
import { InvoicePhotoField } from "../shared/InvoicePhotoField";
import { BottomActionSheet } from "../shared/BottomActionSheet";
import { areSameInvoicePhotos, persistInvoicePhoto, removeInvoicePhoto, type InvoicePhotoSelection } from "../../invoicePhotos";
import { localDay } from "../../../../domain/splitDate";
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
  MeasuredFloatingFooter,
  HeroCard,
  PrimaryButton,
  QuietButton,
  ScreenHeader,
  SecondaryButton,
  SectionCard,
  SectionEyebrow,
  SoftInput,
  StatPill,
  useFloatingFooterInset,
} from "../../../../components/ui";
import {
  buildShareSummary,
  computeSettlement,
  createEmptyItem,
  createId,
  formatMoney,
  SPLIT_NAME_MAX_LENGTH,
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
import {
  trackSplitStepCompleted,
  trackSplitTagsUsed,
} from "../../../../lib/telemetry";
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
  getSplitTagDisplayLabel,
  isDefaultSplitTag,
  sortTagsAlphabetically,
} from "../../tags";
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
import { buildRecordRoute } from "../../routes";
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
import { SetupTagPicker } from "../shared/SetupTagPicker";
import { TagEditorModal } from "../shared/TagEditorModal";

const Paragraph = TamaguiParagraph as any;
const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

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
// The setup flow intentionally orchestrates many independent sections and states.
// eslint-disable-next-line complexity
export function SetupScreenView({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const record = useRecord(draftId);
  const { updateDraftMeta, setStep, settings, getActiveRecord, addTag } =
    useSplitStore(
      useShallow((state) => ({
        updateDraftMeta: state.updateDraftMeta,
        setStep: state.setStep,
        settings: state.settings,
        getActiveRecord: state.getActiveRecord,
        addTag: state.addTag,
      })),
    );
  const insets = useSafeAreaInsets();
  const [splitName, setSplitName] = useState(record?.values.splitName ?? "");
  const [splitDate, setSplitDate] = useState(record?.values.splitDate ?? (record ? localDay(new Date(record.createdAt)) : localDay(new Date())));
  const [invoicePhotoUri, setInvoicePhotoUri] = useState<string | null>(record?.values.invoicePhotoUri ?? null);
  const [invoicePhotoName, setInvoicePhotoName] = useState<string | null>(record?.values.invoicePhotoName ?? null);
  const [invoicePhotoSize, setInvoicePhotoSize] = useState<number | null>(record?.values.invoicePhotoSize ?? null);

  const [currency, setCurrency] = useState(
    record?.values.currency ?? settings.defaultCurrency,
  );
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    record?.values.tagIds ?? [],
  );
  const [rateInput, setRateInput] = useState(
    String(record?.values.exchangeRate?.rate ?? 1),
  );
  const [rateSource, setRateSource] = useState<"auto" | "manual" | "fallback">(
    record?.values.exchangeRate?.rateSource ?? "fallback",
  );
  const [loadingRate, setLoadingRate] = useState(false);
  const loadingRateRef = useRef(false);
  const requestPairRef = useRef("");
  const pendingPairRef = useRef<string | null>(null);
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
  const activeRatePairRef = useRef("");
  const { insetBottom: footerInsetBottom, onMeasuredHeight } =
    useFloatingFooterInset({ fallbackHeight: 186 });
  const buildRateMapFromRecord = (currentRecord: DraftRecord) => {
    const savedByPair = currentRecord.values.exchangeRatesByPair ?? {};
    if (Object.keys(savedByPair).length > 0) {
      return Object.fromEntries(
        Object.entries(savedByPair).map(([key, value]) => [
          key,
          {
            rate: value.rate,
            rateSource: value.rateSource ?? "fallback",
            rateUpdatedAt: value.rateUpdatedAt,
          },
        ]),
      );
    }

    const fallbackRate = currentRecord.values.exchangeRate;
    if (!fallbackRate) {
      return {};
    }

    const key = `${fallbackRate.sourceCurrency.trim().toUpperCase()}->${fallbackRate.targetCurrency
      .trim()
      .toUpperCase()}`;
    return {
      [key]: {
        rate: fallbackRate.rate,
        rateSource: fallbackRate.rateSource ?? "fallback",
        rateUpdatedAt: fallbackRate.rateUpdatedAt,
      },
    };
  };

  useEffect(() => {
    if (record) {
      setSplitName(record.values.splitName ?? "");
      setSplitDate(record.values.splitDate ?? localDay(new Date(record.createdAt)));
      setInvoicePhotoUri(record.values.invoicePhotoUri ?? null);
      setInvoicePhotoName(record.values.invoicePhotoName ?? null);
      setInvoicePhotoSize(record.values.invoicePhotoSize ?? null);
      setCurrency(record.values.currency ?? settings.defaultCurrency);
      setSelectedTagIds(record.values.tagIds ?? []);
      setRateInput(String(record.values.exchangeRate?.rate ?? 1));
      setRateSource(record.values.exchangeRate?.rateSource ?? "fallback");
      setRateUpdatedAt(record.values.exchangeRate?.rateUpdatedAt ?? null);
      setRateByPair(buildRateMapFromRecord(record));
      const source = (record.values.currency ?? settings.defaultCurrency)
        .trim()
        .toUpperCase();
      const target = settings.defaultCurrency.trim().toUpperCase();
      const pairKey = `${source}->${target}`;
      const savedSource = record.values.exchangeRate?.sourceCurrency
        ?.trim()
        .toUpperCase();
      const savedTarget = record.values.exchangeRate?.targetCurrency
        ?.trim()
        .toUpperCase();
      const hasMatchingSavedPair =
        savedSource === source && savedTarget === target;
      if (!hasMatchingSavedPair) {
        setRateInput("1");
        setRateSource("fallback");
        setRateUpdatedAt(null);
      }
      setCurrencyMenuOpen(false);
      setTagModalOpen(false);
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
  const orderedTags = useMemo(
    () =>
      sortTagsAlphabetically(settings.tags ?? [], (tag) =>
        getSplitTagDisplayLabel(tag, t),
      ),
    [settings.tags, t],
  );
  const normalizedCurrency = currency.trim().toUpperCase();
  const normalizedTargetCurrency = settings.defaultCurrency
    .trim()
    .toUpperCase();
  const parsedRate = Number(rateInput.replace(",", "."));
  const hasValidRateInput = Number.isFinite(parsedRate) && parsedRate > 0;
  const effectiveRate = hasValidRateInput ? parsedRate : 1;
  const needsConversion = normalizedCurrency !== normalizedTargetCurrency;
  const canContinue = Boolean(normalizedCurrency);
  const isSetupStepReady =
    Boolean(splitName.trim()) &&
    canContinue &&
    (!needsConversion || hasValidRateInput);
  const fetchLiveRate = async () => {
    if (!needsConversion) {
      return;
    }
    if (loadingRateRef.current) {
      pendingPairRef.current = `${normalizedCurrency}->${normalizedTargetCurrency}`;
      return;
    }
    const pairKey = `${normalizedCurrency}->${normalizedTargetCurrency}`;
    requestPairRef.current = pairKey;
    loadingRateRef.current = true;
    setLoadingRate(true);
    try {
      const result = await fetchExchangeRate(
        normalizedCurrency,
        normalizedTargetCurrency,
      );
      if (requestPairRef.current !== pairKey) {
        return;
      }
      setRateInput(String(result.rate));
      setRateSource(result.source);
      const updatedAt = new Date().toISOString();
      setRateUpdatedAt(updatedAt);
      setRateByPair((prev) => ({
        ...prev,
        [pairKey]: {
          rate: result.rate,
          rateSource: result.source,
          rateUpdatedAt: updatedAt,
        },
      }));
    } finally {
      loadingRateRef.current = false;
      setLoadingRate(false);
      const pendingPair = pendingPairRef.current;
      if (pendingPair && pendingPair !== pairKey) {
        pendingPairRef.current = null;
      }
    }
  };

  const handleInvoicePhotoChange = (photo: InvoicePhotoSelection | null) => {
    setInvoicePhotoUri(photo?.uri ?? null);
    setInvoicePhotoName(photo?.name ?? null);
    setInvoicePhotoSize(photo?.size ?? null);
  };

  const handleRateInputChange = (value: string) => {
    const numericValue = Number(value.replace(",", "."));
    setRateInput(value);
    setRateSource("manual");
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
    } else {
      setRateUpdatedAt(null);
      setRateByPair((prev) => {
        const next = { ...prev };
        delete next[`${normalizedCurrency}->${normalizedTargetCurrency}`];
        return next;
      });
    }
  };

  useEffect(() => {
    const pairKey = `${normalizedCurrency}->${normalizedTargetCurrency}`;
    const pairChanged = activeRatePairRef.current !== pairKey;
    if (pairChanged) {
      activeRatePairRef.current = pairKey;
    }
    const savedPairRate = rateByPair[pairKey];
    if (!savedPairRate && rateSource === "manual" && !pairChanged) {
      return;
    }
    if (!savedPairRate) {
      setRateInput("1");
      setRateSource("fallback");
      setRateUpdatedAt(null);
      return;
    }
    setRateInput(String(savedPairRate.rate));
    setRateSource(savedPairRate.rateSource);
    setRateUpdatedAt(savedPairRate.rateUpdatedAt ?? null);
  }, [normalizedCurrency, normalizedTargetCurrency, rateSource]);

  useEffect(() => {
    if (!needsConversion) {
      return;
    }
    if (rateSource === "manual") {
      return;
    }
    const pairKey = `${normalizedCurrency}->${normalizedTargetCurrency}`;
    if (!normalizedCurrency || !normalizedTargetCurrency) {
      return;
    }
    const persistedRateByPair = record?.values.exchangeRatesByPair ?? {};
    const persistedEntry = persistedRateByPair[pairKey];
    const legacyRate = record?.values.exchangeRate;
    const legacyPairMatches = Boolean(
      legacyRate &&
      legacyRate.sourceCurrency.trim().toUpperCase() === normalizedCurrency &&
      legacyRate.targetCurrency.trim().toUpperCase() ===
        normalizedTargetCurrency &&
      Number.isFinite(legacyRate.rate) &&
      legacyRate.rate > 0,
    );

    if (rateByPair[pairKey] || persistedEntry || legacyPairMatches) {
      return;
    }
    void fetchLiveRate();
  }, [
    record,
    needsConversion,
    normalizedCurrency,
    normalizedTargetCurrency,
    rateByPair,
    rateSource,
  ]);

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
    const pairKey = `${normalizedCurrency}->${normalizedTargetCurrency}`;
    const nextRateByPair = { ...rateByPair };
    if (needsConversion && hasValidRateInput) {
      nextRateByPair[pairKey] = {
        rate: effectiveRate,
        rateSource,
        rateUpdatedAt: rateUpdatedAt ?? undefined,
      };
    }

    const savedPhoto = await persistInvoicePhoto(invoicePhotoUri);
    try {
    await updateDraftMeta(
      splitName.trim().slice(0, SPLIT_NAME_MAX_LENGTH),
      normalizedCurrency,
      needsConversion
        ? {
            sourceCurrency: normalizedCurrency,
            targetCurrency: normalizedTargetCurrency,
            rate: effectiveRate,
            rateSource,
            rateUpdatedAt: rateUpdatedAt ?? undefined,
          }
        : undefined,
      Object.fromEntries(
        Object.entries(nextRateByPair).map(([key, value]) => [
          key,
          {
            sourceCurrency: key.split("->")[0] ?? normalizedCurrency,
            targetCurrency: key.split("->")[1] ?? normalizedTargetCurrency,
            rate: value.rate,
            rateSource: value.rateSource,
            rateUpdatedAt: value.rateUpdatedAt ?? undefined,
          },
        ]),
      ),
      selectedTagIds,
      splitDate,
      savedPhoto,
      invoicePhotoUri ? invoicePhotoName : null,
      invoicePhotoUri ? invoicePhotoSize : null,
    );
    } catch (error) {
      if (!areSameInvoicePhotos(savedPhoto, record?.values.invoicePhotoUri)) await removeInvoicePhoto(savedPhoto);
      throw error;
    }
    if (!areSameInvoicePhotos(record?.values.invoicePhotoUri, savedPhoto)) await removeInvoicePhoto(record?.values.invoicePhotoUri);
    setInvoicePhotoUri(savedPhoto);
    const selectedTags = (settings.tags ?? []).filter((tag) =>
      selectedTagIds.includes(tag.id),
    );
    void trackSplitTagsUsed({
      tagCount: selectedTags.length,
      builtInTagCount: selectedTags.filter(isDefaultSplitTag).length,
      customTagCount: selectedTags.filter((tag) => !isDefaultSplitTag(tag))
        .length,
    });
    await setStep(2);
    const currentStatus = getActiveRecord()?.status ?? record.status;
    await trackSplitStepCompleted({
      step: "setup",
      draftStatus: currentStatus,
    });
    router.push(`/split/${draftId}/participants`);
  };

  return (
    <AppScreen
      scroll={false}
      overlay={
        <>
          <SplitNoticeModal
            messages={setupNoticeMessages}
            onDismiss={() => setSetupNoticeMessages([])}
          />
          {currencyMenuOpen ? (
            <BottomActionSheet
              visible
              title={t("flow.setup.currency")}
              cancelLabel={t("common.cancel")}
              bottomInset={insets.bottom}
              selectionMode
              showCancel={false}
              options={currencyOptions.map((option) => ({
                label: option.label,
                selected: normalizedCurrency === option.code,
                onPress: () => {
                  requestPairRef.current = "";
                  setCurrency(option.code);
                  setCurrencyMenuOpen(false);
                },
              }))}
              onDismiss={() => setCurrencyMenuOpen(false)}
            />
          ) : null}
          {tagModalOpen ? (
            <TagEditorModal
              existingTags={settings.tags ?? []}
              onCancel={() => setTagModalOpen(false)}
              onSave={async (label, icon, color) => {
                const before = settings.tags ?? [];
                const saved = await addTag(label, icon, color);
                if (!saved) {
                  return false;
                }
                const after = useSplitStore.getState().settings.tags ?? [];
                const created = after.find(
                  (tag) => !before.some((entry) => entry.id === tag.id),
                );
                if (created) {
                  setSelectedTagIds((current) => [...current, created.id]);
                }
                setTagModalOpen(false);
                return true;
              }}
            />
          ) : null}
          {showRateConfirmModal ? (
            <ConfirmChoiceModal
              title={t("flow.setup.rateConfirmTitle")}
              body={t("flow.setup.rateConfirmBody")}
              confirmLabel={t("flow.setup.rateConfirmContinue")}
              discardLabel={t("flow.setup.rateConfirmEdit")}
              onConfirm={() => {
                setShowRateConfirmModal(false);
                void persistAndContinue().catch(() => setSetupNoticeMessages([t("common.tryAgain")]));
              }}
              onDiscard={() => setShowRateConfirmModal(false)}
            />
          ) : null}
        </>
      }
      footer={
        tagModalOpen ? null : (
          <MeasuredFloatingFooter onMeasuredHeight={onMeasuredHeight}>
            <FlowContinueButton
              accessibilityLabel={t("flow.setup.nextA11y")}
              disabled={!isSetupStepReady}
              label={t("flow.setup.next", undefined, { maxLength: 26 })}
              onPress={async () => {
                if (!canContinue) {
                  return;
                }
                if (!splitName.trim()) {
                  setSetupNoticeMessages([t("flow.setup.nameRequired")]);
                  return;
                }
                if (needsConversion && !hasValidRateInput) {
                  setSetupNoticeMessages([t("flow.setup.exchangeRateInvalid")]);
                  return;
                }
                if (needsConversion && effectiveRate === 1) {
                  setShowRateConfirmModal(true);
                  return;
                }
                await persistAndContinue().catch(() => setSetupNoticeMessages([t("common.tryAgain")]));
              }}
            />
          </MeasuredFloatingFooter>
        )
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
          { paddingBottom: footerInsetBottom },
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
                    setSplitName(value.slice(0, SPLIT_NAME_MAX_LENGTH));
                    if (setupNoticeMessages.length > 0) {
                      setSetupNoticeMessages([]);
                    }
                  }}
                  placeholder={t("flow.setup.splitNamePlaceholder")}
                  placeholderTextColor={PALETTE.inputPlaceholder}
                  style={screenStyles.assignInput}
                  maxLength={SPLIT_NAME_MAX_LENGTH}
                />
              </View>
            </YStack>



            <XStack alignItems="flex-start" gap="$3">
              <YStack flex={1} gap="$2">
                <SplitDatePicker value={splitDate} onChange={setSplitDate} />
              </YStack>
              <YStack flex={1} gap="$2">
                <FieldLabel>{t("flow.setup.currency")}</FieldLabel>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("flow.setup.currency")}
                  style={[screenStyles.selectRow, { minHeight: 64, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 0 }]}
                  onPress={() => setCurrencyMenuOpen((value) => !value)}
                >
                  <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <Text
                      fontFamily={FONTS.bodyMedium}
                      fontSize={15}
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
            </XStack>
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
                        accessibilityLabel={t("flow.setup.exchangeRateA11y")}
                        value={rateInput}
                        onChangeText={handleRateInputChange}
                        placeholder={t("flow.setup.exchangeRatePlaceholder")}
                        placeholderTextColor={PALETTE.inputPlaceholder}
                        keyboardType="decimal-pad"
                        style={screenStyles.assignInput}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        "flow.setup.refreshExchangeRateA11y",
                      )}
                      onPress={() => {
                        void fetchLiveRate();
                      }}
                      style={[
                        screenStyles.settingsInlineAction,
                        {
                          width: 46,
                          height: 46,
                          borderRadius: 14,
                          backgroundColor: loadingRate
                            ? PALETTE.surfaceContainerHigh
                            : PALETTE.primary,
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
            <SetupTagPicker
              tags={orderedTags}
              selectedTagIds={selectedTagIds}
              onToggle={(tagId) => {
                setSelectedTagIds((current) =>
                  current.includes(tagId)
                    ? current.filter((id) => id !== tagId)
                    : [...current, tagId],
                );
              }}
              onAdd={() => setTagModalOpen(true)}
            />
            <InvoicePhotoField
              value={invoicePhotoUri}
              fileSize={invoicePhotoSize}
              onChange={handleInvoicePhotoChange}
            />
          </YStack>
        </YStack>
      </ScrollView>
    </AppScreen>
  );
}
