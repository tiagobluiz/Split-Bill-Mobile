import { useEffect, useRef, useState } from "react";
import { Animated, Keyboard } from "react-native";
import { router } from "expo-router";
import { useShallow } from "zustand/react/shallow";

import { AppScreen, EmptyState, useFloatingFooterInset } from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import {
  formatMoney,
  parseMoneyToCents,
  resetPercentAllocations,
  resetShareAllocations,
  validateStepThree,
} from "../../../../domain";
import { getDeviceLocale } from "../../../../lib/device";
import { trackItemSplitModeUsedOnce } from "../../../../lib/telemetry";
import type { DraftRecord } from "../../../../storage/records";
import { useSplitStore } from "../../store";
import {
  cloneAllocations,
  cloneItem,
  formatPercentValue,
  getAssignedParticipantCount,
  getFriendlySplitMessage,
  getItemCategoryLabel,
  getNextPendingSplitItemId,
  getPercentInputMessage,
  hasTrailingPercentSeparator,
  normalizeCommittedPercentValue,
  normalizePercentInput,
  rebalanceEditablePercentAllocations,
} from "../shared/recordUtils";
import { useRecord } from "../shared/hooks";
import { SplitItemView } from "./SplitItemView";

const SPLIT_COMPACT_HEADER_ANIMATION_MS = 160;

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
  const [summaryBottomY, setSummaryBottomY] = useState(0);
  const [isCompactHeaderVisible, setIsCompactHeaderVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const compactHeaderAnimatedValue = useRef(new Animated.Value(0)).current;
  const modeAllocationsRef = useRef<{
    even: DraftRecord["values"]["items"][number]["allocations"];
    shares: DraftRecord["values"]["items"][number]["allocations"];
    percent: DraftRecord["values"]["items"][number]["allocations"];
  } | null>(null);
  const { insetBottom: splitFooterInsetBottom, onMeasuredHeight } =
    useFloatingFooterInset({ fallbackHeight: 196 });

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

  useEffect(() => {
    Animated.timing(compactHeaderAnimatedValue, {
      toValue: isCompactHeaderVisible ? 1 : 0,
      duration: SPLIT_COMPACT_HEADER_ANIMATION_MS,
      useNativeDriver: true,
    }).start();
  }, [compactHeaderAnimatedValue, isCompactHeaderVisible]);

  useEffect(() => {
    setIsCompactHeaderVisible(false);
  }, [itemId]);

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
  const itemNameLabel = item.name || t("flow.splitItem.untitled");
  const itemPriceLabel = formatMoney(
    parseMoneyToCents(item.price) ?? 0,
    record.values.currency,
    locale,
  );
  const itemCategoryLabel = getItemCategoryLabel(item);
  const splitErrors = validateStepThree({
    ...record.values,
    items: [item],
  });
  const isSplitReady = splitErrors.length === 0;
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

    try {
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
      void trackItemSplitModeUsedOnce({
        draftId,
        itemId: item.id,
        mode: committedItem.splitMode,
      });
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
    } catch {
      setSplitNoticeMessages([t("flow.splitItem.saveFailed")]);
    }
  };

  return (
    <SplitItemView
      record={record}
      item={item}
      settings={settings}
      splitNoticeMessages={splitNoticeMessages}
      onDismissSplitNotice={() => setSplitNoticeMessages([])}
      onMeasuredHeight={onMeasuredHeight}
      splitFooterInsetBottom={splitFooterInsetBottom}
      headerHeight={headerHeight}
      onHeaderHeightMeasured={(nextHeaderHeight) => {
        setHeaderHeight((current) =>
          Math.abs(current - nextHeaderHeight) < 1 ? current : nextHeaderHeight,
        );
      }}
      summaryBottomY={summaryBottomY}
      onSummaryBottomMeasured={(nextSummaryBottom) => {
        setSummaryBottomY((current) =>
          Math.abs(current - nextSummaryBottom) < 1
            ? current
            : nextSummaryBottom,
        );
      }}
      compactHeaderAnimatedValue={compactHeaderAnimatedValue}
      isCompactHeaderVisible={isCompactHeaderVisible}
      onCompactHeaderVisibilityChange={(updater) => {
        setIsCompactHeaderVisible(updater);
      }}
      onCompactHeaderHidden={() => setIsCompactHeaderVisible(false)}
      itemNameLabel={itemNameLabel}
      itemPriceLabel={itemPriceLabel}
      itemCategoryLabel={itemCategoryLabel}
      ctaLabel={ctaLabel}
      isSplitReady={isSplitReady}
      onConfirmSplit={() => void confirmSplit()}
      onBack={() => router.replace(`/split/${draftId}/overview`)}
      locale={locale}
      assignedCount={assignedCount}
      evenShareDisplayCents={evenShareDisplayCents}
      totalShares={totalShares}
      shareValue={shareValue}
      totalPercent={totalPercent}
      displayTotalPercent={displayTotalPercent}
      percentSliderResetKey={percentSliderResetKey}
      setSplitMode={setSplitMode}
      includeAllWorkingSplit={includeAllWorkingSplit}
      excludeAllWorkingSplit={excludeAllWorkingSplit}
      incrementShares={incrementShares}
      toggleEvenIncluded={toggleEvenIncluded}
      setWorkingPercentValue={setWorkingPercentValue}
      finalizeWorkingPercentValue={finalizeWorkingPercentValue}
      getRemainingPercentForParticipant={getRemainingPercentForParticipant}
    />
  );
}
