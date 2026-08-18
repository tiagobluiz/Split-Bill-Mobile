import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
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
  SectionCard,
  useFloatingFooterInset,
} from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import {
  createEmptyItem,
  formatMoney,
  ITEM_AMOUNT_MAX_CENTS,
  ITEM_NAME_MAX_LENGTH,
  normalizeMoneyInput,
  parseMoneyToCents,
  resetPercentAllocations,
  resetShareAllocations,
  validateStepThree,
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
  const { createItem, removeItem, updateItemField } = useSplitStore(
    useShallow((state) => ({
      createItem: state.createItem,
      removeItem: state.removeItem,
      updateItemField: state.updateItemField,
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
  const isNewItem = itemId === "new";
  const effectiveCategory = item.category?.trim() || "General";
  const sourceCategory = sourceItem?.category?.trim() ?? "";
  const initialCategory = sourceCategory || "General";
  const isDirty = isNewItem
    ? item.name.trim().length > 0 || item.price.trim().length > 0
    : sourceItem != null
      ? sourceItem.name !== item.name ||
        sourceItem.price !== item.price ||
        initialCategory !== effectiveCategory
      : false;
  const normalizedItemPrice =
    item.price.trim().length > 0 ? normalizeMoneyInput(item.price) : "";
  const parsedItemPriceCents = normalizedItemPrice
    ? parseMoneyToCents(normalizedItemPrice)
    : null;
  const trimmedItemName = item.name.trim();
  const hasValidName = trimmedItemName.length > 0;
  const hasValidPrice =
    parsedItemPriceCents !== null && parsedItemPriceCents !== 0;
  const isSaveReady = hasValidName && hasValidPrice;
  const normalizedManualName = trimmedItemName.replace(/\s+/g, " ").toLowerCase();
  const mergeCandidate = record.values.items.find(
    (candidate) =>
      candidate.id !== item.id &&
      candidate.name.trim().replace(/\s+/g, " ").toLowerCase() ===
        normalizedManualName,
  );

  const updateWorkingItemField = async (
    field: "name" | "price" | "category",
    value: string,
  ) => {
    setAssignNoticeMessages([]);
    const nextValue =
      field === "name" ? value.slice(0, ITEM_NAME_MAX_LENGTH) : value;
    setEditorItem((current) => ({ ...current!, [field]: nextValue }));
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

      if (isNewItem && mergeCandidate) {
        setMergeCandidateItemId(mergeCandidate.id);
        return;
      }

      if (!isNewItem && mergeCandidate) {
        setAssignNoticeMessages([t("flow.itemDetail.duplicateItem")]);
        return;
      }

      if (isNewItem) {
        await createItem({
          ...item,
          name: trimmedItemName,
          price: normalizedItemPrice,
          category: effectiveCategory,
        });
        rememberItemOrigins(draftId, [item.id], "manual");
        await trackEvent("item_insertion_success", {
          method: "manual",
          item_count: 1,
          provider: "none",
          import_mode: "none",
        });
        router.back();
        return;
      }

      const persistedSourceItem = sourceItem as NonNullable<typeof sourceItem>;
      if (persistedSourceItem.name !== trimmedItemName) {
        await updateItemField(item.id, "name", trimmedItemName);
      }
      if (
        normalizeMoneyInput(persistedSourceItem.price) !== normalizedItemPrice
      ) {
        await updateItemField(item.id, "price", normalizedItemPrice);
      }
      if ((persistedSourceItem.category?.trim() ?? "") !== effectiveCategory) {
        await updateItemField(item.id, "category", effectiveCategory);
      }

      router.back();
    } catch (error) {
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
      const targetCents = parseMoneyToCents(targetItem.price) ?? 0;
      const mergedCents = targetCents + parsedItemPriceCents;
      if (mergedCents === 0) {
        setMergeCandidateItemId("");
        setAssignNoticeMessages([t("validation.itemAmountInvalid")]);
        return;
      }
      if (Math.abs(mergedCents) > ITEM_AMOUNT_MAX_CENTS) {
        setMergeCandidateItemId("");
        setAssignNoticeMessages([t("validation.itemAmountTooHigh")]);
        return;
      }
      const mergedPrice = normalizeMoneyInput(
        (mergedCents / 100).toFixed(2),
      );
      await updateItemField(targetItem.id, "price", mergedPrice);
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
                  await removeItem(item.id);
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
              body={t("flow.itemDetail.mergeDuplicate.body", {
                name: mergeCandidate.name,
                amount: formatMoney(
                  parseMoneyToCents(mergeCandidate.price) ?? 0,
                  record.values.currency,
                  locale,
                ),
                mergedAmount: formatMoney(
                  (parseMoneyToCents(mergeCandidate.price) ?? 0) +
                    (parsedItemPriceCents ?? 0),
                  record.values.currency,
                  locale,
                ),
              })}
              confirmLabel={t("flow.itemDetail.mergeDuplicate.confirm")}
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
                disabled={!isSaveReady}
                onPress={() => void saveEditor()}
              />
            </View>
          </XStack>
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
              <View style={screenStyles.assignInputShell}>
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

            <YStack gap="$2">
              <XStack alignItems="center" justifyContent="space-between">
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={11}
                  color={PALETTE.onSurfaceVariant}
                  textTransform="uppercase"
                  letterSpacing={2.1}
                >
                  {t("flow.itemDetail.price")}
                </Text>
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={11}
                  color={PALETTE.primary}
                  textTransform="uppercase"
                  letterSpacing={1.8}
                >
                  {t("common.currencyPrefix", { currency: record.values.currency })}
                </Text>
              </XStack>
              <View style={screenStyles.assignInputShell}>
                <TextInput
                  ref={priceInputRef}
                  accessibilityLabel={t("flow.itemDetail.priceA11y")}
                  value={item.price}
                  onChangeText={(value) =>
                    void updateWorkingItemField("price", value)
                  }
                  onSubmitEditing={() => Keyboard.dismiss()}
                  placeholder={zeroMoney}
                  placeholderTextColor="rgba(86, 67, 57, 0.28)"
                  style={screenStyles.assignPriceInput}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </YStack>
          </YStack>

          <SectionCard>
            <FieldLabel>{t("flow.itemDetail.category")}</FieldLabel>
            <XStack flexWrap="wrap" gap="$2.5">
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
          </SectionCard>
        </YStack>
      </ScrollView>
    </AppScreen>
  );
}

