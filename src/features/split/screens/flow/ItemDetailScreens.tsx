import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
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
  FieldLabel,
  FloatingFooter,
  SectionCard,
} from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import {
  createEmptyItem,
  formatMoney,
  itemHasDuplicate,
  normalizeMoneyInput,
  parseMoneyToCents,
  resetPercentAllocations,
  resetShareAllocations,
  validateStepThree,
} from "../../../../domain";
import { getDeviceLocale } from "../../../../lib/device";
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

const MAX_ITEM_NAME_LENGTH = 25;
const SPLIT_FOOTER_BASE_PADDING = 164;
const FLOATING_FOOTER_VERTICAL_PADDING = 46;
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
  const nameInputRef = useRef<TextInput>(null);
  const priceInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

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
  const duplicateItemExists = itemHasDuplicate(
    record.values.items,
    {
      ...item,
      name: trimmedItemName,
      price: normalizedItemPrice,
      category: effectiveCategory,
    },
    isNewItem ? undefined : item.id,
  );

  const updateWorkingItemField = async (
    field: "name" | "price" | "category",
    value: string,
  ) => {
    setAssignNoticeMessages([]);
    const nextValue =
      field === "name" ? value.slice(0, MAX_ITEM_NAME_LENGTH) : value;
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
    if (!hasValidName) {
      setAssignNoticeMessages([t("flow.itemDetail.nameRequired")]);
      return;
    }

    if (!hasValidPrice) {
      setAssignNoticeMessages([t("flow.itemDetail.priceRequired")]);
      return;
    }

    if (duplicateItemExists) {
      setAssignNoticeMessages([
        "This item already exists. Change the name, price, or category.",
      ]);
      return;
    }

    if (isNewItem) {
      await createItem({
        ...item,
        name: trimmedItemName,
        price: normalizedItemPrice,
        category: effectiveCategory,
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
  };

  const deleteEditorItem = async () => {
    setShowDeleteItemModal(true);
  };

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
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
                onPress={() => void saveEditor()}
              />
            </View>
          </XStack>
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
          title={isNewItem ? t("flow.itemDetail.addTitle") : t("flow.itemDetail.editTitle")}
          onBack={() => void closeEditor()}
        />
      </View>
      <ScrollView
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: 164 + Math.max(insets.bottom, 14),
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
                  maxLength={MAX_ITEM_NAME_LENGTH}
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
          onConfirm={() => {
            setShowDeleteItemModal(false);
            void removeItem(item.id).then(() => router.back());
          }}
          onDiscard={() => setShowDeleteItemModal(false)}
        />
      ) : null}
      <SplitNoticeModal
        messages={assignNoticeMessages}
        onDismiss={() => setAssignNoticeMessages([])}
      />
    </AppScreen>
  );
}

export function SplitItemScreen({
  draftId,
  itemId,
}: {
  draftId: string;
  itemId: string;
}) {
  const { t } = useTranslation();
  const record = useRecord(draftId);
  const { saveItemSplit, settings } = useSplitStore(
    useShallow((state) => ({
      saveItemSplit: state.saveItemSplit,
      settings: state.settings,
    })),
  );
  const [workingItem, setWorkingItem] = useState<
    DraftRecord["values"]["items"][number] | null
  >(null);
  const [splitNoticeMessages, setSplitNoticeMessages] = useState<string[]>([]);
  const [percentSliderResetKey, setPercentSliderResetKey] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const modeAllocationsRef = useRef<{
    even: DraftRecord["values"]["items"][number]["allocations"];
    shares: DraftRecord["values"]["items"][number]["allocations"];
    percent: DraftRecord["values"]["items"][number]["allocations"];
  } | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!record) {
      return;
    }

    const sourceItem = record.values.items.find((entry) => entry.id === itemId);
    if (sourceItem) {
      const sourceAllocations = cloneAllocations(sourceItem.allocations);
      modeAllocationsRef.current = {
        even:
          sourceItem.splitMode === "even"
            ? sourceAllocations
            : cloneAllocations(sourceItem.allocations),
        shares:
          sourceItem.splitMode === "shares"
            ? cloneAllocations(sourceItem.allocations)
            : resetShareAllocations(cloneAllocations(sourceItem.allocations)),
        percent:
          sourceItem.splitMode === "percent"
            ? cloneAllocations(sourceItem.allocations)
            : resetPercentAllocations(cloneAllocations(sourceItem.allocations)),
      };
      setWorkingItem(cloneItem(sourceItem));
      setSplitNoticeMessages([]);
      return;
    }
    modeAllocationsRef.current = null;
    setWorkingItem(null);
    setSplitNoticeMessages([]);
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

  const item = workingItem;
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
  const splitErrors = validateStepThree({
    ...record.values,
    items: [item],
  });
  const pendingNextItemId = getNextPendingSplitItemId(record, item.id);
  const ctaLabel = pendingNextItemId
    ? t("flow.splitItem.confirmNext")
    : t("flow.splitItem.confirmReview");
  const totalShares = item.allocations.reduce(
    (sum, allocation) => sum + (parseFloat(allocation.shares) || 0),
    0,
  );
  const shareValue =
    totalShares > 0 ? (parseMoneyToCents(item.price) ?? 0) / totalShares : 0;
  const assignedCount = getAssignedParticipantCount(item);
  const evenShareDisplayCents =
    assignedCount > 0
      ? Math.floor(
          (parseMoneyToCents(item.price) ?? 0) / Math.max(assignedCount, 1),
        )
      : 0;
  const totalPercent = item.allocations.reduce(
    (sum, allocation) => sum + (parseFloat(allocation.percent) || 0),
    0,
  );
  const splitScrollBottomPadding =
    footerHeight > 0
      ? footerHeight
      : SPLIT_FOOTER_BASE_PADDING + Math.max(insets.bottom, 14);
  const displayTotalPercent =
    Math.abs(totalPercent - 100) <= 0.01
      ? "100"
      : Number.isInteger(totalPercent)
        ? String(totalPercent)
        : totalPercent.toFixed(2).replace(/\.?0+$/, "");

  const getRemainingPercentForParticipant = (participantId: string) => {
    const otherTotal = item.allocations.reduce((sum, allocation) => {
      if (allocation.participantId === participantId) {
        return sum;
      }

      return sum + (parseFloat(allocation.percent) || 0);
    }, 0);

    return Math.max(0, Math.round((100 - otherTotal) * 100) / 100);
  };

  const setSplitMode = (splitMode: "even" | "shares" | "percent") => {
    setSplitNoticeMessages([]);
    setWorkingItem((current) => {
      const nextCurrent = current!;
      const currentMode = nextCurrent.splitMode;
      const modeAllocations = modeAllocationsRef.current!;
      modeAllocations[currentMode] = cloneAllocations(nextCurrent.allocations);
      const nextAllocations = cloneAllocations(modeAllocations[splitMode]);
      return { ...nextCurrent, splitMode, allocations: nextAllocations };
    });
  };

  const updateWorkingAllocations = (
    updater: (
      allocations: DraftRecord["values"]["items"][number]["allocations"],
    ) => DraftRecord["values"]["items"][number]["allocations"],
  ) => {
    setWorkingItem((current) => {
      const nextCurrent = current!;
      const nextAllocations = updater(nextCurrent.allocations);
      modeAllocationsRef.current![nextCurrent.splitMode] =
        cloneAllocations(nextAllocations);
      return {
        ...nextCurrent,
        allocations: nextAllocations,
      };
    });
  };

  const toggleEvenIncluded = (participantId: string) => {
    setSplitNoticeMessages([]);
    updateWorkingAllocations((allocations) =>
      allocations.map((allocation) =>
        allocation.participantId === participantId
          ? { ...allocation, evenIncluded: !allocation.evenIncluded }
          : allocation,
      ),
    );
  };

  const incrementShares = (participantId: string, delta: number) => {
    setSplitNoticeMessages([]);
    updateWorkingAllocations((allocations) =>
      allocations.map((allocation) => {
        if (allocation.participantId !== participantId) {
          return allocation;
        }

        const nextShares = Math.max(
          0,
          (parseFloat(allocation.shares) || 0) + delta,
        );
        return { ...allocation, shares: String(nextShares) };
      }),
    );
  };

  const includeAllWorkingSplit = () => {
    setSplitNoticeMessages([]);
    updateWorkingAllocations((allocations) => {
      const nextCurrent = workingItem!;

      if (nextCurrent.splitMode === "even") {
        return allocations.map((allocation) => ({
          ...allocation,
          evenIncluded: true,
        }));
      }

      if (nextCurrent.splitMode === "shares") {
        return allocations.map((allocation) => ({
          ...allocation,
          shares:
            (parseFloat(allocation.shares) || 0) > 0 ? allocation.shares : "1",
        }));
      }

      const currentTotalBasisPoints = allocations.reduce((sum, allocation) => {
        return sum + Math.round((parseFloat(allocation.percent) || 0) * 100);
      }, 0);
      const missingBasisPoints = Math.max(0, 10000 - currentTotalBasisPoints);
      const zeroPercentParticipantIds = allocations
        .filter((allocation) => (parseFloat(allocation.percent) || 0) <= 0)
        .map((allocation) => allocation.participantId);

      if (missingBasisPoints === 0 || zeroPercentParticipantIds.length === 0) {
        return allocations;
      }

      const baseShare = Math.floor(
        missingBasisPoints / zeroPercentParticipantIds.length,
      );
      let remainder = missingBasisPoints % zeroPercentParticipantIds.length;
      const additionByParticipantId = new Map<string, number>();
      zeroPercentParticipantIds.forEach((participantId) => {
        const addition = baseShare + (remainder > 0 ? 1 : 0);
        additionByParticipantId.set(participantId, addition);
        if (remainder > 0) {
          remainder -= 1;
        }
      });

      return allocations.map((allocation) => {
        const addition = additionByParticipantId.get(allocation.participantId);
        if (addition === undefined) {
          return allocation;
        }

        return {
          ...allocation,
          percent: formatPercentValue(addition / 100),
          percentLocked: false,
        };
      });
    });
  };

  const excludeAllWorkingSplit = () => {
    setSplitNoticeMessages([]);
    updateWorkingAllocations((allocations) => {
      const nextCurrent = workingItem!;

      if (nextCurrent.splitMode === "even") {
        return allocations.map((allocation) => ({
          ...allocation,
          evenIncluded: false,
        }));
      }

      if (nextCurrent.splitMode === "percent") {
        return allocations.map((allocation) => ({
          ...allocation,
          percent: "0",
          percentLocked: false,
        }));
      }

      return allocations.map((allocation) => ({
        ...allocation,
        shares: "0",
      }));
    });
  };

  const setWorkingPercentValue = async (
    participantId: string,
    nextValue: string,
    options?: { clampToRemaining?: boolean },
  ) => {
    if (nextValue.trim() === "") {
      setSplitNoticeMessages([]);
      updateWorkingAllocations((allocations) =>
        allocations.map((allocation) =>
          allocation.participantId === participantId
            ? { ...allocation, percent: nextValue }
            : allocation,
        ),
      );
      return;
    }

    const normalizedValue = normalizePercentInput(nextValue);
    if (hasTrailingPercentSeparator(nextValue)) {
      setSplitNoticeMessages([]);
      updateWorkingAllocations((allocations) =>
        allocations.map((allocation) =>
          allocation.participantId === participantId
            ? { ...allocation, percent: nextValue }
            : allocation,
        ),
      );
      return;
    }

    const percentInputMessage = getPercentInputMessage(normalizedValue);
    if (percentInputMessage) {
      Keyboard.dismiss();
      setPercentSliderResetKey((current) => current + 1);
      setSplitNoticeMessages([percentInputMessage]);
      return;
    }

    const nextAllocations = rebalanceEditablePercentAllocations(
      item.allocations,
      participantId,
      normalizedValue,
      options,
    );
    if (!nextAllocations) {
      const remainingPercentForParticipant =
        getRemainingPercentForParticipant(participantId);
      const currentPercent =
        parseFloat(
          item.allocations.find(
            (allocation) => allocation.participantId === participantId,
          )!.percent,
        ) || 0;
      const noPercentLeft =
        remainingPercentForParticipant <= currentPercent + 0.001;
      Keyboard.dismiss();
      setPercentSliderResetKey((current) => current + 1);
      setSplitNoticeMessages([
        noPercentLeft
          ? t("flow.splitItem.percentFullyAllocated")
          : t("flow.splitItem.percentTooHigh"),
      ]);
      return;
    }

    setSplitNoticeMessages([]);
    updateWorkingAllocations(() => nextAllocations);
  };

  const finalizeWorkingPercentValue = (participantId: string) => {
    let didNormalizeTrailingSeparator = false;
    updateWorkingAllocations((allocations) =>
      allocations.map((allocation) => {
        if (allocation.participantId !== participantId) {
          return allocation;
        }

        if (!hasTrailingPercentSeparator(allocation.percent)) {
          return allocation;
        }

        didNormalizeTrailingSeparator = true;
        return {
          ...allocation,
          percent: normalizeCommittedPercentValue(allocation.percent),
        };
      }),
    );

    if (didNormalizeTrailingSeparator) {
      setSplitNoticeMessages([]);
    }
  };

  const confirmSplit = async () => {
    if (splitErrors.length > 0) {
      setSplitNoticeMessages([
        ...new Set(splitErrors.map(getFriendlySplitMessage)),
      ]);
      return;
    }

    const committedItem =
      item.splitMode === "percent"
        ? {
            ...item,
            allocations: item.allocations.map((allocation) => ({
              ...allocation,
              percent: normalizeCommittedPercentValue(allocation.percent),
            })),
          }
        : item;

    await saveItemSplit(item.id, committedItem);
    const nextPendingItemId = getNextPendingSplitItemId(
      {
        ...record,
        values: {
          ...record.values,
          items: record.values.items.map((candidate) =>
            candidate.id === item.id ? committedItem : candidate,
          ),
        },
      },
      item.id,
    );
    if (nextPendingItemId) {
      router.push(`/split/${draftId}/split/${nextPendingItemId}`);
      return;
    }

    router.push(`/split/${draftId}/overview`);
  };

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <View
            onLayout={(event) => {
              const nextHeight =
                Math.round(event.nativeEvent.layout.height) +
                FLOATING_FOOTER_VERTICAL_PADDING;
              setFooterHeight((current) =>
                current === nextHeight ? current : nextHeight,
              );
            }}
          >
          <YStack gap="$3">
            {item.splitMode === "even" ? (
              <YStack style={screenStyles.splitFooterInlineSummary}>
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={10}
                  color={PALETTE.onSurfaceVariant}
                  textTransform="uppercase"
                  letterSpacing={2.1}
                >
                  {t("flow.splitItem.splitBy")}
                </Text>
                <XStack alignItems="flex-end" justifyContent="space-between" gap="$3">
                  <Text
                    fontFamily={FONTS.headlineBlack}
                    fontSize={30}
                    color={PALETTE.onSurface}
                    letterSpacing={-1.1}
                  >
                    {assignedCount}
                  </Text>
                  <Text
                    fontFamily={FONTS.bodyMedium}
                    fontSize={14}
                    color={PALETTE.onSurfaceVariant}
                  >
                    {t("flow.splitItem.shareRate", {
                      amount: formatMoney(
                        evenShareDisplayCents,
                        record.values.currency,
                        locale,
                      ),
                    })}
                  </Text>
                </XStack>
              </YStack>
            ) : null}
            {item.splitMode === "shares" ? (
              <YStack style={screenStyles.splitFooterInlineSummary}>
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={10}
                  color={PALETTE.onSurfaceVariant}
                  textTransform="uppercase"
                  letterSpacing={2.1}
                >
                  {t("flow.splitItem.totalShares")}
                </Text>
                <XStack alignItems="flex-end" justifyContent="space-between" gap="$3">
                  <Text
                    fontFamily={FONTS.headlineBlack}
                    fontSize={30}
                    color={PALETTE.onSurface}
                    letterSpacing={-1.1}
                  >
                    {totalShares}
                  </Text>
                  <Text
                    fontFamily={FONTS.bodyMedium}
                    fontSize={14}
                    color={PALETTE.onSurfaceVariant}
                  >
                    {t("flow.splitItem.shareRate", {
                      amount: formatMoney(
                        Math.round(shareValue),
                        record.values.currency,
                        locale,
                      ),
                    })}
                  </Text>
                </XStack>
              </YStack>
            ) : null}
            {item.splitMode === "percent" ? (
              <YStack style={screenStyles.splitFooterInlineSummary}>
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={10}
                  color={PALETTE.onSurfaceVariant}
                  textTransform="uppercase"
                  letterSpacing={2.1}
                >
                  {t("flow.splitItem.mode.percent")}
                </Text>
                <Text
                  fontFamily={FONTS.headlineBlack}
                  fontSize={30}
                  color={PALETTE.onSurface}
                  letterSpacing={-1.1}
                >
                  {t("flow.splitItem.totalPercent", { percent: displayTotalPercent })}
                </Text>
              </YStack>
            ) : null}
            <FlowContinueButton
              label={ctaLabel}
              onPress={() => void confirmSplit()}
            />
          </YStack>
          </View>
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
          title={t("flow.splitItem.title")}
          onBack={() => router.replace(`/split/${draftId}/overview`)}
        />
      </View>
      <View style={screenStyles.splitScrollViewport}>
        <ScrollView
          style={screenStyles.flex}
          contentContainerStyle={[
            screenStyles.participantsScrollContent,
            {
              paddingBottom: splitScrollBottomPadding,
              gap: 22,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <YStack gap="$5">
          <YStack gap="$2" alignItems="center">
            <View style={screenStyles.splitCategoryPill}>
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={11}
                color={PALETTE.primary}
                textTransform="uppercase"
                letterSpacing={1.8}
              >
                {getItemCategoryLabel(item)}
              </Text>
            </View>
            <Text
              fontFamily={FONTS.headlineBlack}
              fontSize={34}
              color={PALETTE.onSurface}
              textAlign="center"
              letterSpacing={-1.4}
            >
              {item.name || t("flow.splitItem.untitled")}
            </Text>
            <Text
              fontFamily={FONTS.headlineBold}
              fontSize={24}
              color={PALETTE.primary}
            >
              {formatMoney(
                parseMoneyToCents(item.price) ?? 0,
                record.values.currency,
                locale,
              )}
            </Text>
          </YStack>

          <View style={screenStyles.splitModeShell}>
            <ModeToggle active={item.splitMode} onChange={setSplitMode} />
          </View>

          <YStack gap="$4">
            <XStack justifyContent="flex-end" alignItems="center">
              <View style={screenStyles.splitHeaderSegmentedControl}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("flow.splitItem.includeAllA11y")}
                  onPress={includeAllWorkingSplit}
                  style={[
                    screenStyles.splitHeaderSegment,
                    screenStyles.splitHeaderSegmentLeft,
                  ]}
                >
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={13}
                    color={PALETTE.primary}
                    textTransform="uppercase"
                  >
                    {t("flow.splitItem.all")}
                  </Text>
                </Pressable>
                <View style={screenStyles.splitHeaderSegmentDivider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("flow.splitItem.excludeAllA11y")}
                  onPress={excludeAllWorkingSplit}
                  style={[
                    screenStyles.splitHeaderSegment,
                    screenStyles.splitHeaderSegmentRight,
                  ]}
                >
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={13}
                    color={PALETTE.onSurface}
                    textTransform="uppercase"
                  >
                    {t("flow.splitItem.none")}
                  </Text>
                </Pressable>
              </View>
            </XStack>

            <YStack gap="$4">
              {record.values.participants.map((participant) => {
                const allocation = item.allocations.find(
                  (entry) => entry.participantId === participant.id,
                );
                if (!allocation) {
                  return null;
                }

                const portionCents =
                  item.splitMode === "even" &&
                  assignedCount > 0 &&
                  allocation.evenIncluded
                    ? Math.floor(
                        (parseMoneyToCents(item.price) ?? 0) /
                          Math.max(assignedCount, 1),
                      )
                    : 0;
                const shareCount = parseFloat(allocation.shares) || 0;
                const percentValue = parseFloat(allocation.percent) || 0;
                const remainingPercentForParticipant =
                  getRemainingPercentForParticipant(participant.id);
                const canAssignRemaining =
                  item.splitMode === "percent" &&
                  remainingPercentForParticipant > percentValue + 0.001 &&
                  totalPercent < 99.99;

                const participantControls = (
                  <>
                    <XStack
                      alignItems="center"
                      justifyContent="space-between"
                      gap="$3"
                    >
                      <XStack alignItems="center" gap="$3" flex={1}>
                        <ParticipantAvatar
                          name={participant.name}
                          ownerName={settings.ownerName}
                          ownerProfileImageUri={settings.ownerProfileImageUri}
                          style={screenStyles.splitAvatar}
                          label={`Split avatar ${participant.name}`}
                        />
                        <YStack flex={1} gap="$1">
                          <Text
                            fontFamily={FONTS.headlineBold}
                            fontSize={18}
                            color={PALETTE.onSurface}
                          >
                            {getParticipantDisplayName(
                              participant.name,
                              settings.ownerName,
                            )}
                          </Text>
                          {item.splitMode === "even" ? (
                            <Text
                              fontFamily={FONTS.bodyMedium}
                              fontSize={13}
                              color={PALETTE.onSurfaceVariant}
                            >
                              {allocation.evenIncluded
                                ? t("flow.splitItem.portion", {
                                    amount: formatMoney(
                                      portionCents,
                                      record.values.currency,
                                      locale,
                                    ),
                                  })
                                : t("flow.splitItem.tapToInclude")}
                            </Text>
                          ) : item.splitMode === "shares" ? (
                            <Text
                              fontFamily={FONTS.bodyMedium}
                              fontSize={13}
                              color={PALETTE.onSurfaceVariant}
                            >
                              {t("flow.splitItem.portion", {
                                amount: formatMoney(
                                  Math.round(
                                    totalShares > 0
                                      ? ((parseMoneyToCents(item.price) ?? 0) *
                                          shareCount) /
                                          totalShares
                                      : 0,
                                  ),
                                  record.values.currency,
                                  locale,
                                ),
                              })}
                            </Text>
                          ) : null}
                        </YStack>
                      </XStack>

                      {item.splitMode === "even" ? (
                        <View
                          style={[
                            allocation.evenIncluded
                              ? screenStyles.payerSelectedIndicator
                              : screenStyles.payerUnselectedIndicator,
                            { pointerEvents: "none" },
                          ]}
                        >
                          {allocation.evenIncluded ? (
                            <Check color={PALETTE.onPrimary} size={16} />
                          ) : null}
                        </View>
                      ) : null}

                      {item.splitMode === "shares" ? (
                        <XStack alignItems="center" gap="$2.5">
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t(
                              "flow.splitItem.decreaseSharesA11y",
                              { name: participant.name },
                            )}
                            onPress={() => incrementShares(participant.id, -1)}
                            style={screenStyles.splitStepperButton}
                          >
                            <Text
                              fontFamily={FONTS.headlineBold}
                              fontSize={18}
                              color={PALETTE.primary}
                            >
                              -
                            </Text>
                          </Pressable>
                          <View style={screenStyles.splitStepperValue}>
                            <Text
                              fontFamily={FONTS.headlineBold}
                              fontSize={20}
                              color={PALETTE.onSurface}
                            >
                              {shareCount}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t(
                              "flow.splitItem.increaseSharesA11y",
                              { name: participant.name },
                            )}
                            onPress={() => incrementShares(participant.id, 1)}
                            style={[
                              screenStyles.splitStepperButton,
                              screenStyles.splitStepperButtonActive,
                            ]}
                          >
                            <Text
                              fontFamily={FONTS.headlineBold}
                              fontSize={18}
                              color={PALETTE.onPrimary}
                            >
                              +
                            </Text>
                          </Pressable>
                        </XStack>
                      ) : null}

                      {item.splitMode === "percent" ? (
                        <View style={screenStyles.percentValueShell}>
                          {canAssignRemaining ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t(
                                "flow.splitItem.useRemainingPercentA11y",
                                { name: participant.name },
                              )}
                              onPress={() =>
                                void setWorkingPercentValue(
                                  participant.id,
                                  String(remainingPercentForParticipant),
                                )
                              }
                              style={screenStyles.percentRemainderIcon}
                            >
                              <Text
                                fontFamily={FONTS.headlineBold}
                                fontSize={15}
                                color={PALETTE.primary}
                              >
                                &gt;&gt;
                              </Text>
                            </Pressable>
                          ) : null}
                          <TextInput
                            accessibilityLabel={t(
                              "flow.splitItem.percentA11y",
                              { name: participant.name },
                            )}
                            value={allocation.percent}
                            onChangeText={(value) =>
                              void setWorkingPercentValue(participant.id, value)
                            }
                            onBlur={() =>
                              finalizeWorkingPercentValue(participant.id)
                            }
                            onSubmitEditing={() =>
                              finalizeWorkingPercentValue(participant.id)
                            }
                            placeholder="0"
                            placeholderTextColor={PALETTE.primary}
                            keyboardType="number-pad"
                            style={screenStyles.percentValueInput}
                          />
                          <Text
                            fontFamily={FONTS.headlineBold}
                            fontSize={18}
                            color={PALETTE.primary}
                          >
                            %
                          </Text>
                        </View>
                      ) : null}
                    </XStack>

                    {item.splitMode === "percent" ? (
                      <YStack gap="$2.5" paddingTop="$2">
                        <Slider
                          key={`percent-slider-${participant.id}-${percentSliderResetKey}`}
                          accessibilityLabel={t(
                            "flow.splitItem.percentSliderA11y",
                            { name: participant.name },
                          )}
                          minimumValue={0}
                          maximumValue={100}
                          step={1}
                          value={Math.max(0, Math.min(percentValue, 100))}
                          minimumTrackTintColor={PALETTE.primary}
                          maximumTrackTintColor={PALETTE.track}
                          thumbTintColor={PALETTE.primary}
                          onValueChange={(value) =>
                            void setWorkingPercentValue(
                              participant.id,
                              String(value),
                              { clampToRemaining: true },
                            )
                          }
                        />
                        <XStack justifyContent="space-between">
                          <Text
                            fontFamily={FONTS.bodyMedium}
                            fontSize={11}
                            color={PALETTE.onSurfaceVariant}
                          >
                            {formatMoney(0, record.values.currency, locale)}
                          </Text>
                          <Text
                            fontFamily={FONTS.bodyBold}
                            fontSize={11}
                            color={PALETTE.onSurfaceVariant}
                          >
                            {t("flow.splitItem.allocated", {
                              amount: formatMoney(
                                Math.round(
                                  ((parseMoneyToCents(item.price) ?? 0) *
                                    percentValue) /
                                    100,
                                ),
                                record.values.currency,
                                locale,
                              ),
                            })}
                          </Text>
                          <Text
                            fontFamily={FONTS.bodyMedium}
                            fontSize={11}
                            color={PALETTE.onSurfaceVariant}
                          >
                            {formatMoney(
                              parseMoneyToCents(item.price) ?? 0,
                              record.values.currency,
                              locale,
                            )}
                          </Text>
                        </XStack>
                      </YStack>
                    ) : null}
                  </>
                );

                return (
                  <View
                    key={participant.id}
                    style={screenStyles.splitParticipantCard}
                  >
                    {participantControls}
                    {item.splitMode === "even" ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("flow.splitItem.toggleEvenA11y", {
                          name: participant.name,
                        })}
                        onPress={() => toggleEvenIncluded(participant.id)}
                        style={screenStyles.splitParticipantOverlayPressable}
                      />
                    ) : null}
                  </View>
                );
              })}
            </YStack>
          </YStack>
          </YStack>
        </ScrollView>
      </View>
      <SplitNoticeModal
        messages={splitNoticeMessages}
        onDismiss={() => setSplitNoticeMessages([])}
      />
    </AppScreen>
  );
}
