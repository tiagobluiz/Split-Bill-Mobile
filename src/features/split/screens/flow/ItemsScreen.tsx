import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
  ArrowRight,
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
import type { DraftRecord } from "../../../../storage/records";
import { FONTS, PALETTE } from "../../../../theme/palette";
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
  getLatestPendingSplitItem,
  getLatestPendingSplitItemId,
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
import { ErrorList, ModePills, ModeToggle } from "../shared/components";
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
export function ItemsScreenView({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const { removeItem, setStep } = useSplitStore(
    useShallow((state) => ({
      removeItem: state.removeItem,
      setStep: state.setStep,
    })),
  );
  const [itemsNoticeMessages, setItemsNoticeMessages] = useState<string[]>([]);
  const [pendingItemDelete, setPendingItemDelete] = useState<null | {
    id: string;
    title: string;
  }>(null);
  const itemDeleteTimeoutRef = useRef<any>(null);
  const pendingItemDeleteRef = useRef<null | { id: string; title: string }>(
    null,
  );
  const insets = useSafeAreaInsets();
  useEffect(() => {
    return () => {
      if (itemDeleteTimeoutRef.current) {
        clearTimeout(itemDeleteTimeoutRef.current);
        itemDeleteTimeoutRef.current = null;
      }
      const pendingDelete = pendingItemDeleteRef.current;
      if (pendingDelete) {
        void removeItem(pendingDelete.id);
      }
    };
  }, [removeItem]);
  if (!record) {
    return (
      <AppScreen scroll={false}>
        <EmptyState
          title="Loading draft"
          description="Opening your split record."
        />
      </AppScreen>
    );
  }
  const locale = getDeviceLocale();
  const effectiveRecordForStep = pendingItemDelete
    ? {
        ...record,
        values: {
          ...record.values,
          items: record.values.items.filter(
            (item) => item.id !== pendingItemDelete.id,
          ),
        },
      }
    : record;
  const stepTwoErrors = [
    ...new Set(validateStepTwo(record.values).map((error) => error.message)),
  ];
  const visibleItems =
    effectiveRecordForStep.values.items.filter(isVisibleItem);
  const effectiveStepTwoErrors = [
    ...new Set(
      validateStepTwo(effectiveRecordForStep.values).map(
        (error) => error.message,
      ),
    ),
  ];
  const isItemsStepReady = effectiveStepTwoErrors.length === 0;
  const runningTotal = formatMoney(
    visibleItems.reduce(
      (sum, item) => sum + (parseMoneyToCents(item.price) ?? 0),
      0,
    ),
    record.values.currency,
    locale,
  );
  const addManualItem = async () => {
    setItemsNoticeMessages([]);
    router.push(`/split/${draftId}/assign/new`);
  };
  const commitPendingItemDelete = async (nextPending: {
    id: string;
    title: string;
  }) => {
    if (itemDeleteTimeoutRef.current) {
      clearTimeout(itemDeleteTimeoutRef.current);
      itemDeleteTimeoutRef.current = null;
    }
    if (pendingItemDeleteRef.current?.id === nextPending.id) {
      pendingItemDeleteRef.current = null;
      setPendingItemDelete(null);
    }
    await removeItem(nextPending.id);
  };
  const queueItemDelete = (itemId: string, title: string) => {
    const pendingDelete = pendingItemDeleteRef.current;
    if (pendingDelete?.id && pendingDelete.id !== itemId) {
      void removeItem(pendingDelete.id);
    }
    if (itemDeleteTimeoutRef.current) {
      clearTimeout(itemDeleteTimeoutRef.current);
    }
    const nextPending = { id: itemId, title };
    pendingItemDeleteRef.current = nextPending;
    setPendingItemDelete(nextPending);
    itemDeleteTimeoutRef.current = setTimeout(() => {
      void commitPendingItemDelete(nextPending);
    }, 4000);
  };
  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <YStack gap="$3.5">
            {pendingItemDelete ? (
              <View style={screenStyles.undoBanner}>
                <YStack flex={1} gap="$1">
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={14}
                    color={PALETTE.onPrimary}
                  >
                    Item deleted
                  </Text>
                  <Text
                    fontFamily={FONTS.bodyMedium}
                    fontSize={12}
                    color="rgba(255,255,255,0.82)"
                  >
                    {pendingItemDelete.title}
                  </Text>
                </YStack>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Undo item delete"
                  style={screenStyles.undoButton}
                  onPress={() => {
                    clearTimeout(itemDeleteTimeoutRef.current);
                    itemDeleteTimeoutRef.current = null;
                    pendingItemDeleteRef.current = null;
                    setPendingItemDelete(null);
                  }}
                >
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={12}
                    color={PALETTE.onPrimary}
                    textTransform="uppercase"
                    letterSpacing={1.6}
                  >
                    Undo
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <YStack gap="$1">
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={10}
                color={PALETTE.onSurfaceVariant}
                textTransform="uppercase"
                letterSpacing={2.1}
              >
                Running total
              </Text>
              <XStack alignItems="flex-end" gap="$2.5">
                <Text
                  fontFamily={FONTS.headlineBlack}
                  fontSize={30}
                  color={PALETTE.onSurface}
                  letterSpacing={-1.2}
                >
                  {runningTotal}
                </Text>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  color={PALETTE.onSurfaceVariant}
                  paddingBottom="$1"
                >
                  {`${visibleItems.length} ${visibleItems.length === 1 ? "item" : "items"}`}
                </Text>
              </XStack>
            </YStack>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next: Split Bill"
              accessibilityHint={
                isItemsStepReady
                  ? "Continues to split assignments."
                  : "Shows validation errors before continuing."
              }
              style={[
                screenStyles.itemsNextButton,
                !isItemsStepReady
                  ? screenStyles.participantsContinueButtonDisabled
                  : null,
              ]}
              onPress={async () => {
                if (!isItemsStepReady) {
                  setItemsNoticeMessages([
                    ...new Set(
                      effectiveStepTwoErrors.map(getFriendlySplitMessage),
                    ),
                  ]);
                  return;
                }
                if (pendingItemDelete) {
                  await commitPendingItemDelete(pendingItemDelete);
                }
                await setStep(5);
                const nextItem = getLatestPendingSplitItem(
                  effectiveRecordForStep,
                );
                router.push(
                  nextItem
                    ? `/split/${draftId}/split/${nextItem.id}`
                    : `/split/${draftId}/overview`,
                );
              }}
            >
              <XStack alignItems="center" justifyContent="center" gap="$2.5">
                <Text
                  fontFamily={FONTS.headlineBlack}
                  fontSize={18}
                  color={
                    !isItemsStepReady
                      ? PALETTE.onSurfaceVariant
                      : PALETTE.onPrimary
                  }
                >
                  Next: Split Bill
                </Text>
                <ArrowRight
                  color={
                    !isItemsStepReady
                      ? PALETTE.onSurfaceVariant
                      : PALETTE.onPrimary
                  }
                  size={20}
                />
              </XStack>
            </Pressable>
          </YStack>
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
          title="Add Items"
          onBack={() => router.replace(`/split/${draftId}/payer`)}
        />
      </View>
      <ScrollView
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          { paddingBottom: 188 + Math.max(insets.bottom, 14), gap: 22 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
          <View style={screenStyles.itemsImportCard}>
            <XStack alignItems="center" gap="$3">
              <View style={screenStyles.itemsImportIconWrap}>
                <ReceiptText color={PALETTE.primary} size={16} />
              </View>
              <XStack alignItems="center" gap="$2.5" flex={1}>
                <YStack justifyContent="center" minHeight={34} flex={1}>
                  <Text
                    fontFamily={FONTS.headlineBold}
                    fontSize={18}
                    color={PALETTE.onSurface}
                  >
                    Import Receipt
                  </Text>
                </YStack>
                <View style={screenStyles.soonChip}>
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={10}
                    color={PALETTE.primary}
                    textTransform="uppercase"
                    letterSpacing={1.2}
                  >
                    Soon
                  </Text>
                </View>
              </XStack>
            </XStack>
            <XStack gap="$3" paddingTop="$3.5">
              <View
                accessibilityLabel="Scan Photo coming soon"
                style={[
                  screenStyles.itemsImportPrimaryButton,
                  screenStyles.itemsImportButtonDisabled,
                ]}
              >
                <XStack alignItems="center" justifyContent="center" gap="$2">
                  <Camera color={PALETTE.onSurfaceVariant} size={16} />
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={13}
                    color={PALETTE.onSurfaceVariant}
                  >
                    Scan Photo
                  </Text>
                </XStack>
              </View>
              <View
                accessibilityLabel="AI Paste coming soon"
                style={[
                  screenStyles.itemsImportSecondaryButton,
                  screenStyles.itemsImportButtonDisabled,
                ]}
              >
                <XStack alignItems="center" justifyContent="center" gap="$2">
                  <ClipboardCopy color={PALETTE.onSurfaceVariant} size={16} />
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={13}
                    color={PALETTE.onSurfaceVariant}
                  >
                    AI Paste
                  </Text>
                </XStack>
              </View>
            </XStack>
          </View>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$3.5">
            <YStack gap="$3">
              {visibleItems.map((item, index) => {
                const itemTitle = item.name.trim() || `Item ${index + 1}`;
                return (
                  <Swipeable
                    key={item.id}
                    overshootRight={false}
                    renderRightActions={() => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete item ${itemTitle}`}
                        style={screenStyles.recentSwipeDeleteAction}
                        onPress={() => queueItemDelete(item.id, itemTitle)}
                      >
                        <Trash2 color={PALETTE.onPrimary} size={18} />
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={12}
                          color={PALETTE.onPrimary}
                          textTransform="uppercase"
                          letterSpacing={1.6}
                        >
                          Delete
                        </Text>
                      </Pressable>
                    )}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open item ${itemTitle}`}
                      accessibilityActions={[
                        { name: "delete", label: `Delete item ${itemTitle}` },
                      ]}
                      onAccessibilityAction={(event) => {
                        if (event.nativeEvent.actionName === "delete") {
                          queueItemDelete(item.id, itemTitle);
                        }
                      }}
                      style={screenStyles.itemsListCard}
                      onPress={() =>
                        router.push(`/split/${draftId}/assign/${item.id}`)
                      }
                    >
                    <XStack
                      alignItems="center"
                      justifyContent="space-between"
                      gap="$4"
                    >
                      <YStack flex={1} gap="$1.5">
                        <Text
                          fontFamily={FONTS.headlineBold}
                          fontSize={18}
                          color={PALETTE.onSurface}
                        >
                          {itemTitle}
                        </Text>
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={11}
                          color={PALETTE.onSurfaceVariant}
                          textTransform="uppercase"
                          letterSpacing={1.5}
                        >
                          {getItemCategoryLabel(item)}
                        </Text>
                      </YStack>
                      <Text
                        fontFamily={FONTS.headlineBold}
                        fontSize={18}
                        color={PALETTE.onSurface}
                      >
                        {formatMoney(
                          parseMoneyToCents(item.price) ?? 0,
                          record.values.currency,
                          locale,
                        )}
                      </Text>
                    </XStack>
                    </Pressable>
                  </Swipeable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add Item Manually"
                style={screenStyles.itemsManualAddButton}
                onPress={() => void addManualItem()}
              >
                <XStack alignItems="center" justifyContent="center" gap="$2.5">
                  <View style={screenStyles.itemsManualAddIconWrap}>
                    <Plus color={PALETTE.onPrimary} size={14} />
                  </View>
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={15}
                    color={PALETTE.onSurfaceVariant}
                  >
                    Add Item Manually
                  </Text>
                </XStack>
              </Pressable>
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
      <SplitNoticeModal
        messages={itemsNoticeMessages}
        onDismiss={() => setItemsNoticeMessages([])}
      />
    </AppScreen>
  );
}
