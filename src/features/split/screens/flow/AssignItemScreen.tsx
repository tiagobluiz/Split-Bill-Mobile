import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { ArrowRight, Check, Minus, Trash2 } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  AppScreen,
  EmptyState,
  FooterBubble,
  FieldLabel,
  MeasuredFloatingFooter,
  useFloatingFooterInset,
} from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import {
  getItemTotalCents,
  validateItemPricing,
  createEmptyItem,
  combineItemAmounts,
  formatMoney,
  ITEM_NAME_MAX_LENGTH,
  itemHasDuplicate,
  normalizeMoneyInput,
  parseMoneyToCents,
  resetPercentAllocations,
  resetShareAllocations,
  validateStepThree,
  normalizeItemName,
} from "../../../../domain";
import { getDeviceLocale } from "../../../../lib/device";
import { rememberItemOrigins, recordError, trackEvent } from "../../../../lib/telemetry";
import type { DraftRecord } from "../../../../storage/records";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useSplitStore } from "../../store";
import { getParticipantDisplayName } from "../shared/participantUtils";
import {
  cloneAllocations,
  cloneItem,
  formatPercentValue,
  getAssignedParticipantCount,
  getCategoryAccessibilityLabel,
  getCategoryLabel,
  getFriendlySplitMessage,
  getItemCategoryLabel,
  getNextPendingSplitItemId,
  getPercentInputMessage,
  hasTrailingPercentSeparator,
  normalizeCommittedPercentValue,
  normalizePercentInput,
  rebalanceEditablePercentAllocations,
} from "../shared/recordUtils";
import { ConfirmChoiceModal, SplitNoticeModal } from "../shared/modals";
import { ParticipantAvatar } from "../shared/participantComponents";
import { FlowScreenHeader } from "../shared/flowComponents";
import { FlowContinueButton, ModeToggle } from "../shared/components";
import { useRecord } from "../shared/hooks";
import { clampItemDiscount, getItemCurrencySymbol, ItemPriceRow, ItemDiscountCard, ItemPricingSummary } from "./ItemPricingControls";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

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
const SPLIT_COMPACT_HEADER_SHOW_OFFSET = 6;
const SPLIT_COMPACT_HEADER_HIDE_OFFSET = 18;
const SPLIT_COMPACT_HEADER_ANIMATION_MS = 160;
export function AssignItemScreen({
  draftId,
  itemId,
}: {
  draftId: string;
  itemId: string;
}) {
  const { t } = useTranslation();
  const record = useRecord(draftId);
  const { createItem, removeItem, saveItemSplit, settings } = useSplitStore(
    useShallow((state) => ({
      createItem: state.createItem,
      removeItem: state.removeItem,
      saveItemSplit: state.saveItemSplit,
      settings: state.settings,
    })),
  );
  const [editorItem, setEditorItem] = useState<
    DraftRecord["values"]["items"][number] | null
  >(null);
  const [assignNoticeMessages, setAssignNoticeMessages] = useState<string[]>(
    [],
  );
  const [showDiscardChangesModal, setShowDiscardChangesModal] = useState(false);
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [mergeCandidateItemId, setMergeCandidateItemId] = useState("");
  const nameInputRef = useRef<TextInput>(null);
  const priceInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const { insetBottom: footerInsetBottom, onMeasuredHeight } =
    useFloatingFooterInset({ fallbackHeight: 178 });

  useEffect(() => {
    if (!record) {
      return;
    }

    if (itemId === "new") {
      setEditorItem(
        (current) =>
          current ?? {
            ...createEmptyItem(record.values.participants),
            category: "General",
          },
      );
      return;
    }

    const sourceItem = record.values.items.find((entry) => entry.id === itemId);
    if (sourceItem) {
      setEditorItem((current) => {
        if (current?.id === sourceItem.id) {
          return current;
        }
        return { ...sourceItem };
      });
      return;
    }
    setEditorItem(null);
  }, [itemId, record]);

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

  const sourceItem =
    itemId === "new"
      ? null
      : record.values.items.find((entry) => entry.id === itemId);
  const item = editorItem;
  if (!item) {
    return (
      <AppScreen scroll={false}>
        <EmptyState
          title={t("flow.itemDetail.missingTitle")}
          description={t("flow.itemDetail.missingDescription")}
        />
      </AppScreen>
    );
  }

  const locale = getDeviceLocale();
  const zeroMoney = formatMoney(0, record.values.currency, locale);
  const currencySymbol = getItemCurrencySymbol(record.values.currency, locale, settings.customCurrencies?.find((currency) => currency.code === record.values.currency)?.symbol);
  const isNewItem = itemId === "new";
  const effectiveCategory = item.category?.trim() || "General";
  const sourceCategory = sourceItem?.category?.trim() ?? "";
  const initialCategory = sourceCategory || "General";
  const isDirty = isItemEditorDirty(item, sourceItem, isNewItem, initialCategory, effectiveCategory);
  const normalizedItemPrice =
    item.price.trim().length > 0 ? normalizeMoneyInput(item.price) : "";
  const parsedItemPriceCents = normalizedItemPrice
    ? parseMoneyToCents(normalizedItemPrice)
    : null;
  const trimmedItemName = item.name.trim();
  const hasValidName = trimmedItemName.length > 0;
  const hasValidPrice =
    parsedItemPriceCents !== null && parsedItemPriceCents !== 0;
  const isSaveReady = hasValidName && trimmedItemName.length <= ITEM_NAME_MAX_LENGTH && getItemTotalCents(item) !== null;
  const normalizedManualName = normalizeItemName(trimmedItemName);
  const mergeCandidate = itemHasDuplicate(record.values.items, item, item.id)
    ? record.values.items.find(
        (candidate) =>
          candidate.id !== item.id &&
          normalizeItemName(candidate.name) === normalizedManualName,
      )
    : undefined;
  const mergeCandidateMergedCents =
    mergeCandidate && parsedItemPriceCents !== null
      ? (getItemTotalCents(mergeCandidate) ?? 0) + (getItemTotalCents(item) ?? 0)
      : null;

  const updateWorkingItemField = async (
    field: "name" | "price" | "category",
    value: string,
  ) => {
    setAssignNoticeMessages([]);
    const nextValue =
      field === "name" ? value.slice(0, ITEM_NAME_MAX_LENGTH) : value;
    setEditorItem((current) => clampItemDiscount({ ...current!, [field]: nextValue }));
  };

  const closeEditor = async () => {
    if (isDirty) {
      setShowDiscardChangesModal(true);
      return;
    }
    router.back();
  };

  const saveEditor = async () => {
    try {
      if (!hasValidName) {
        setAssignNoticeMessages([t("flow.itemDetail.nameRequired")]);
        return;
      }

      if (!hasValidPrice) {
        setAssignNoticeMessages([t("flow.itemDetail.priceRequired")]);
        return;
      }

      const pricingErrors = validateItemPricing(item);
      if (pricingErrors.length > 0) {
        setAssignNoticeMessages(pricingErrors.map((error) => error.message));
        return;
      }

      if (isNewItem && mergeCandidate) {
        setMergeCandidateItemId(mergeCandidate.id);
        return;
      }

      const isRenamingExistingItem =
        !isNewItem &&
        sourceItem != null &&
        normalizeItemName(sourceItem.name) !== normalizedManualName;
      if (!isNewItem && isRenamingExistingItem && mergeCandidate) {
        setAssignNoticeMessages([t("flow.itemDetail.duplicateItem")]);
        return;
      }

      const discount = item.discount && !item.discount.value.trim()
        ? { ...item.discount, value: "0" }
        : item.discount;
      if (isNewItem) {
        const createdItemId = await createItem({
          ...item,
          discount,
          name: trimmedItemName,
          price: normalizedItemPrice,
          category: effectiveCategory,
        }, draftId);
        if (createdItemId) {
          rememberItemOrigins(draftId, [createdItemId], "manual");
        }
        await trackEvent("item_insertion_success", {
          method: "manual",
          item_count: 1,
          provider: "none",
          import_mode: "none",
        });
        router.back();
        return;
      }

      await saveItemSplit(item.id, { ...item, discount, name: trimmedItemName, price: normalizedItemPrice, category: effectiveCategory }, draftId);

      router.back();
    } catch (error) {
      if (error instanceof Error && error.message === "duplicate-item-name") {
        setAssignNoticeMessages([t("flow.itemDetail.duplicateItem")]);
        return;
      }
      recordError(error, {
        screen: "AssignItemScreen",
        action: "saveEditor",
        isNewItem,
      });
      setAssignNoticeMessages([t("flow.itemDetail.saveFailed")]);
    }
  };

  const mergeEditorIntoExistingItem = async () => {
    const targetItem = record.values.items.find(
      (candidate) => candidate.id === mergeCandidateItemId,
    );
    if (!targetItem || parsedItemPriceCents === null) {
      setMergeCandidateItemId("");
      return;
    }

    try {
      const targetCents = getItemTotalCents(targetItem) ?? 0;
      const mergedCents = combineItemAmounts(targetCents, getItemTotalCents(item) ?? 0);
      if (mergedCents === null) {
        setMergeCandidateItemId("");
        setAssignNoticeMessages([t("validation.itemAmountTooHigh")]);
        return;
      }
      if (mergedCents === 0) {
        await removeItem(targetItem.id, draftId);
        setMergeCandidateItemId("");
        router.back();
        return;
      }
      const mergedPrice = normalizeMoneyInput(
        (mergedCents / 100).toFixed(2),
      );
      await saveItemSplit(targetItem.id, { ...targetItem, price: mergedPrice, quantity: 1, discount: null }, draftId);
      await trackEvent("item_insertion_success", {
        method: "manual",
        item_count: 1,
        provider: "none",
        import_mode: "merge",
      });
      setMergeCandidateItemId("");
      router.back();
    } catch (error) {
      recordError(error, {
        screen: "AssignItemScreen",
        action: "mergeEditorIntoExistingItem",
        isNewItem,
      });
      setMergeCandidateItemId("");
      setAssignNoticeMessages([t("flow.itemDetail.saveFailed")]);
    }
  };

  const deleteEditorItem = async () => {
    setShowDeleteItemModal(true);
  };

  return (
    <AppScreen
      scroll={false}
      overlay={(
        <>
          {showDiscardChangesModal ? (
            <ConfirmChoiceModal
              title={t("flow.itemDetail.confirmDiscard.title")}
              body={t("flow.itemDetail.confirmDiscard.body")}
              confirmLabel={t("flow.itemDetail.confirmDiscard.confirm")}
              discardLabel={t("flow.itemDetail.confirmDiscard.discard")}
              onConfirm={() => {
                setShowDiscardChangesModal(false);
                if (!isNewItem && sourceItem) {
                  setEditorItem({ ...sourceItem });
                }
                if (isNewItem) {
                  setEditorItem({
                    ...createEmptyItem(record.values.participants),
                    category: "General",
                  });
                }
                router.back();
              }}
              onDiscard={() => setShowDiscardChangesModal(false)}
            />
          ) : null}
          {showDeleteItemModal ? (
            <ConfirmChoiceModal
              title={t("flow.itemDetail.confirmDelete.title")}
              body={t("flow.itemDetail.confirmDelete.body")}
              confirmLabel={t("flow.itemDetail.confirmDelete.confirm")}
              discardLabel={t("flow.itemDetail.confirmDelete.discard")}
              onConfirm={async () => {
                setShowDeleteItemModal(false);
                try {
                  await removeItem(item.id, draftId);
                  router.back();
                } catch {
                  setAssignNoticeMessages([t("flow.itemDetail.saveFailed")]);
                }
              }}
              onDiscard={() => setShowDeleteItemModal(false)}
            />
          ) : null}
          {mergeCandidateItemId && mergeCandidate ? (
            <ConfirmChoiceModal
              title={t("flow.itemDetail.mergeDuplicate.title")}
              body={t(
                mergeCandidateMergedCents === 0
                  ? "flow.itemDetail.mergeDuplicate.deleteBody"
                  : "flow.itemDetail.mergeDuplicate.body",
                {
                  name: mergeCandidate.name,
                  amount: formatMoney(
                    getItemTotalCents(mergeCandidate) ?? 0,
                    record.values.currency,
                    locale,
                  ),
                  mergedAmount: formatMoney(
                    mergeCandidateMergedCents ?? 0,
                    record.values.currency,
                    locale,
                  ),
                },
              )}
              confirmLabel={t(
                mergeCandidateMergedCents === 0
                  ? "flow.itemDetail.mergeDuplicate.deleteConfirm"
                  : "flow.itemDetail.mergeDuplicate.confirm",
              )}
              discardLabel={t("flow.itemDetail.mergeDuplicate.cancel")}
              onConfirm={() => void mergeEditorIntoExistingItem()}
              onDiscard={() => setMergeCandidateItemId("")}
            />
          ) : null}
          <SplitNoticeModal
            messages={assignNoticeMessages}
            onDismiss={() => setAssignNoticeMessages([])}
          />
        </>
      )}
      footer={
        <MeasuredFloatingFooter onMeasuredHeight={onMeasuredHeight}>
          <YStack gap="$3">
          <ItemPricingSummary item={item} currency={record.values.currency} currencySymbol={currencySymbol} locale={locale} onValueLimitPress={() => setAssignNoticeMessages(validateItemPricing(item).map((error) => error.message))} />
          <XStack gap="$3" alignItems="center">
            {!isNewItem ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("flow.itemDetail.deleteA11y")}
                style={screenStyles.itemDeleteButton}
                onPress={() => void deleteEditorItem()}
              >
                <Trash2 color={PALETTE.danger} size={18} />
              </Pressable>
            ) : null}
            <View
              style={[
                isNewItem
                  ? screenStyles.itemSaveButtonFull
                  : screenStyles.itemSaveButton,
              ]}
            >
              <FlowContinueButton
                accessibilityLabel={t("flow.itemDetail.saveA11y")}
                label={t("flow.itemDetail.save")}
                adaptiveLabel
                disabled={!isSaveReady}
                onPress={() => void saveEditor()}
              />
            </View>
          </XStack>
          </YStack>
        </MeasuredFloatingFooter>
      }
    >
      <View
        style={[
          screenStyles.stickyFlowHeader,
          { paddingTop: Math.max(insets.top + 10, 28) },
        ]}
      >
        <FlowScreenHeader
          title={isNewItem ? t("flow.itemDetail.addTitle") : t("flow.itemDetail.editTitle")}
          onBack={() => void closeEditor()}
        />
      </View>
      <ScrollView
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: footerInsetBottom,
            gap: 22,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <YStack gap="$5">
          <YStack gap="$3.5">
            <YStack gap="$2">
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={11}
                color={PALETTE.onSurfaceVariant}
                textTransform="uppercase"
                letterSpacing={2.1}
              >
                {t("flow.itemDetail.description")}
              </Text>
              <View style={[screenStyles.assignInputShell, { minHeight: 62 }]}>
                <TextInput
                  ref={nameInputRef}
                  accessibilityLabel={t("flow.itemDetail.nameA11y")}
                  value={item.name}
                  maxLength={ITEM_NAME_MAX_LENGTH}
                  onChangeText={(value) =>
                    void updateWorkingItemField("name", value)
                  }
                  onSubmitEditing={() => priceInputRef.current?.focus()}
                  placeholder={t("flow.itemDetail.namePlaceholder")}
                  placeholderTextColor="rgba(86, 67, 57, 0.28)"
                  style={screenStyles.assignInput}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
              </View>
            </YStack>

            <ItemPriceRow
              item={item}
              currency={record.values.currency}
              locale={locale}
              placeholder={zeroMoney}
              priceInputRef={priceInputRef}
              onPriceChange={(value) => void updateWorkingItemField("price", value)}
              onChange={(nextItem) => setEditorItem(clampItemDiscount(nextItem))}
            />
          </YStack>

          <ItemDiscountCard item={item} onChange={(nextItem) => setEditorItem(clampItemDiscount(nextItem))} currency={record.values.currency} locale={locale} currencySymbol={currencySymbol} />

          <YStack gap="$2">
            <FieldLabel>{t("flow.itemDetail.category")}</FieldLabel>
            <View style={screenStyles.recentShadowWrap}>
              <View style={[screenStyles.splitCardSurface, { padding: 16 }]}>
                <XStack flexWrap="wrap" gap="$2">
                  {ITEM_CATEGORY_OPTIONS.map((option) => {
                    const selected = effectiveCategory === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityLabel={t("flow.itemDetail.chooseCategory", {
                          category: getCategoryAccessibilityLabel(option),
                        })}
                        style={[
                          screenStyles.categoryChip,
                          { width: "22%", paddingHorizontal: 4 },
                          selected ? screenStyles.categoryChipActive : null,
                        ]}
                        onPress={() =>
                          void updateWorkingItemField("category", option)
                        }
                      >
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={12}
                          color={
                            selected ? PALETTE.onPrimary : PALETTE.onSurfaceVariant
                          }
                        >
                          {getCategoryLabel(option)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </XStack>
              </View>
            </View>
          </YStack>
        </YStack>
      </ScrollView>
    </AppScreen>
  );
}


function isItemEditorDirty(
  item: DraftRecord["values"]["items"][number],
  source: DraftRecord["values"]["items"][number] | null | undefined,
  isNew: boolean,
  initialCategory: string,
  category: string,
) {
  if (isNew) return Boolean(item.name.trim() || item.price.trim() || (item.quantity ?? 1) !== 1 || item.discount);
  if (!source) return false;
  return source.name !== item.name || source.price !== item.price || initialCategory !== category ||
    (source.quantity ?? 1) !== (item.quantity ?? 1) ||
    JSON.stringify(source.discount ?? null) !== JSON.stringify(item.discount ?? null);
}
