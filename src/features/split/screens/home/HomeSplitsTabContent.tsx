import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ChevronDown, Filter } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  EmptyState,
  FieldLabel,
  SectionCard,
  SectionEyebrow,
} from "../../../../components/ui";
import type { AppSettings } from "../../../../storage/settings";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { getSplitTagDisplayLabel, sortTagsAlphabetically } from "../../tags";
import { ModePills } from "../shared/components";
import { RecordRow } from "../shared/homeParts";
import { TagChip } from "../shared/TagChips";
import { HomeBalanceCards } from "./HomeBalanceCards";
import { HomeMainHeader } from "./HomeMainHeader";
import type {
  ActivityBalanceFilter,
  ActivityDateFilter,
  ActivityStateFilter,
  ActivityTagFilterMode,
  HomeBalances,
  HomeRecord,
  RecordActionTarget,
} from "./homeTypes";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function HomeSplitsTabContent({
  topInset,
  footerInsetBottom,
  settings,
  balances,
  locale,
  filtersExpanded,
  setFiltersExpanded,
  activityStateFilter,
  setActivityStateFilter,
  activityBalanceFilter,
  setActivityBalanceFilter,
  activityDateFilter,
  setActivityDateFilter,
  activityTagFilterIds,
  setActivityTagFilterIds,
  activityTagFilterMode,
  setActivityTagFilterMode,
  visibleSplitCount,
  filteredSplitRecordsLength,
  onIncreaseVisibleCount,
  pagedSplitRecords,
  getSplitReminderLabel,
  onOpenActions,
}: {
  topInset: number;
  footerInsetBottom: number;
  settings: AppSettings;
  balances: HomeBalances;
  locale: string;
  filtersExpanded: boolean;
  setFiltersExpanded: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  activityStateFilter: ActivityStateFilter;
  setActivityStateFilter: (value: ActivityStateFilter) => void;
  activityBalanceFilter: ActivityBalanceFilter;
  setActivityBalanceFilter: (value: ActivityBalanceFilter) => void;
  activityDateFilter: ActivityDateFilter;
  setActivityDateFilter: (value: ActivityDateFilter) => void;
  activityTagFilterIds: string[];
  setActivityTagFilterIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void;
  activityTagFilterMode: ActivityTagFilterMode;
  setActivityTagFilterMode: (value: ActivityTagFilterMode) => void;
  visibleSplitCount: number;
  filteredSplitRecordsLength: number;
  onIncreaseVisibleCount: () => void;
  pagedSplitRecords: HomeRecord[];
  getSplitReminderLabel: (record: HomeRecord) => string | undefined;
  onOpenActions: (target: RecordActionTarget) => void;
}) {
  const { t } = useTranslation();
  const [tagFilterMenuOpen, setTagFilterMenuOpen] = useState(false);
  const [draftTagFilterIds, setDraftTagFilterIds] = useState<string[]>([]);
  const [draftTagFilterMode, setDraftTagFilterMode] =
    useState<ActivityTagFilterMode>("all");
  const orderedTags = useMemo(
    () =>
      sortTagsAlphabetically(settings.tags ?? [], (tag) =>
        getSplitTagDisplayLabel(tag, t),
      ),
    [settings.tags, t],
  );
  const availableTagIds = useMemo(
    () => new Set((settings.tags ?? []).map((tag) => tag.id)),
    [settings.tags],
  );
  const selectedTagLabels = (settings.tags ?? [])
    .filter((tag) => activityTagFilterIds.includes(tag.id))
    .map((tag) => getSplitTagDisplayLabel(tag, t));

  useEffect(() => {
    if (activityTagFilterIds.some((tagId) => !availableTagIds.has(tagId))) {
      setActivityTagFilterIds((current) =>
        current.filter((tagId) => availableTagIds.has(tagId)),
      );
    }
  }, [activityTagFilterIds, availableTagIds, setActivityTagFilterIds]);

  useEffect(() => {
    if (tagFilterMenuOpen) {
      setDraftTagFilterIds(activityTagFilterIds);
      setDraftTagFilterMode(activityTagFilterMode);
    }
  }, [activityTagFilterIds, activityTagFilterMode, tagFilterMenuOpen]);

  return (
    <YStack flex={1}>
      <HomeMainHeader topInset={topInset} />
      {(settings.balanceFeatureEnabled ?? true) ? (
        <YStack gap="$4" paddingHorizontal={20} paddingBottom="$4">
          <HomeBalanceCards
            balances={balances}
            locale={locale}
            settings={settings}
            showSeparator
          />
        </YStack>
      ) : null}
      <ScrollView
        testID="splits-tab-scroll"
        style={screenStyles.flex}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const distanceFromBottom =
            nativeEvent.contentSize.height -
            (nativeEvent.contentOffset.y +
              nativeEvent.layoutMeasurement.height);

          if (
            distanceFromBottom < 240 &&
            visibleSplitCount < filteredSplitRecordsLength
          ) {
            onIncreaseVisibleCount();
          }
        }}
        contentContainerStyle={[
          screenStyles.homeScrollContent,
          { paddingBottom: footerInsetBottom },
        ]}
      >
        <YStack gap="$5">
          <XStack justifyContent="flex-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                filtersExpanded ? t("home.hideFilters") : t("home.showFilters")
              }
              style={[
                screenStyles.settingsInlineAction,
                filtersExpanded
                  ? screenStyles.settingsInlineActionActive
                  : null,
              ]}
              onPress={() => setFiltersExpanded((value) => !value)}
            >
              <Filter color={PALETTE.primary} size={18} />
            </Pressable>
          </XStack>
          {filtersExpanded ? (
            <SectionCard>
              <YStack gap="$3.5">
                <SectionEyebrow>{t("home.filters")}</SectionEyebrow>
                <YStack gap="$2.5">
                  <FieldLabel>{t("home.filter.status")}</FieldLabel>
                  <ModePills
                    active={activityStateFilter}
                    options={[
                      { key: "all", label: t("home.filter.all") },
                      { key: "settled", label: t("home.filter.settled") },
                      { key: "unsettled", label: t("home.filter.unsettled") },
                    ]}
                    onChange={(value: string) =>
                      setActivityStateFilter(value as ActivityStateFilter)
                    }
                  />
                </YStack>
                <YStack gap="$2.5">
                  <FieldLabel>{t("home.filter.balance")}</FieldLabel>
                  <ModePills
                    active={activityBalanceFilter}
                    options={[
                      { key: "all", label: t("home.filter.all") },
                      { key: "nothingDue", label: t("home.filter.nothingDue") },
                      {
                        key: "somethingDue",
                        label: t("home.filter.somethingDue"),
                      },
                    ]}
                    onChange={(value: string) =>
                      setActivityBalanceFilter(value as ActivityBalanceFilter)
                    }
                  />
                </YStack>
                <YStack gap="$2.5">
                  <FieldLabel>{t("home.filter.date")}</FieldLabel>
                  <ModePills
                    active={activityDateFilter}
                    options={[
                      { key: "newest", label: t("home.filter.newest") },
                      { key: "oldest", label: t("home.filter.oldest") },
                    ]}
                    onChange={(value: string) =>
                      setActivityDateFilter(value as ActivityDateFilter)
                    }
                  />
                </YStack>
                <YStack gap="$2.5">
                  <FieldLabel>{t("home.filter.tags")}</FieldLabel>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("home.filter.chooseTags")}
                    style={screenStyles.tagFilterSelectRow}
                    onPress={() => setTagFilterMenuOpen(true)}
                  >
                    <XStack
                      alignItems="center"
                      justifyContent="space-between"
                      gap="$3"
                    >
                      <SectionEyebrow>
                        {selectedTagLabels.length === 0
                          ? t("home.filter.noTags")
                          : selectedTagLabels.length === 1
                            ? selectedTagLabels[0]
                            : t("home.filter.tagsSelectedCount", {
                                count: selectedTagLabels.length,
                              })}
                      </SectionEyebrow>
                      <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
                    </XStack>
                  </Pressable>
                </YStack>
              </YStack>
            </SectionCard>
          ) : null}
          {pagedSplitRecords.length === 0 ? (
            <EmptyState
              title={t("home.noSplitsFilteredTitle")}
              description={t("home.noSplitsDescription")}
            />
          ) : (
            <YStack gap="$3">
              {pagedSplitRecords.map((item) => (
                <RecordRow
                  key={item.id}
                  record={item}
                  ownerName={settings.ownerName}
                  settings={settings}
                  reminderLabel={getSplitReminderLabel(item)}
                  onOpenActions={onOpenActions}
                />
              ))}
            </YStack>
          )}
        </YStack>
      </ScrollView>
      {tagFilterMenuOpen ? (
        <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("modal.dismissActionSheet")}
            style={screenStyles.splitNoticeBackdrop}
            onPress={() => setTagFilterMenuOpen(false)}
          />
          <View style={screenStyles.tagFilterCard}>
            <YStack gap="$3.5">
              <Text
                fontFamily={FONTS.headlineBold}
                fontSize={22}
                color={PALETTE.onSurface}
              >
                {t("home.filter.chooseTags")}
              </Text>
              <YStack gap="$2">
                <FieldLabel>{t("home.filter.tagMatch")}</FieldLabel>
                <ModePills
                  active={draftTagFilterMode}
                  variant="segmented"
                  options={[
                    { key: "all", label: t("home.filter.tagMatchAll") },
                    { key: "any", label: t("home.filter.tagMatchAny") },
                  ]}
                  onChange={(value: string) =>
                    setDraftTagFilterMode(value as ActivityTagFilterMode)
                  }
                />
              </YStack>
              <ScrollView
                style={screenStyles.tagFilterScroll}
                contentContainerStyle={screenStyles.tagFilterContent}
                showsVerticalScrollIndicator
              >
                {orderedTags.map((tag) => {
                  const selected = draftTagFilterIds.includes(tag.id);
                  return (
                    <Pressable
                      key={tag.id}
                      accessibilityRole="button"
                      accessibilityLabel={getSplitTagDisplayLabel(tag, t)}
                      accessibilityState={{ selected }}
                      style={screenStyles.tagFilterOption}
                      onPress={() => {
                        setDraftTagFilterIds((current) =>
                          current.includes(tag.id)
                            ? current.filter((id) => id !== tag.id)
                            : [...current, tag.id],
                        );
                      }}
                    >
                      <TagChip tag={tag} selected={selected} />
                    </Pressable>
                  );
                })}
              </ScrollView>
              <XStack gap="$2.5" alignItems="center">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("common.cancel")}
                  style={screenStyles.tagFilterSecondaryButton}
                  onPress={() => setTagFilterMenuOpen(false)}
                >
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={14}
                    color={PALETTE.primary}
                    textAlign="center"
                  >
                    {t("common.cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("common.clearAll")}
                  style={screenStyles.tagFilterSecondaryButton}
                  onPress={() => setDraftTagFilterIds([])}
                >
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={14}
                    color={PALETTE.primary}
                    textAlign="center"
                  >
                    {t("common.clearAll")}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("home.filter.applyTags")}
                  style={screenStyles.tagFilterPrimaryButton}
                  onPress={() => {
                    setActivityTagFilterIds(draftTagFilterIds);
                    setActivityTagFilterMode(draftTagFilterMode);
                    setTagFilterMenuOpen(false);
                  }}
                >
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={14}
                    color={PALETTE.onPrimary}
                    textAlign="center"
                  >
                    {t("home.filter.applyTags")}
                  </Text>
                </Pressable>
              </XStack>
            </YStack>
          </View>
        </View>
      ) : null}
    </YStack>
  );
}
