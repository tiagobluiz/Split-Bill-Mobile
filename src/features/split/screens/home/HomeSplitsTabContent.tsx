import { Pressable, ScrollView, View } from "react-native";
import { Filter } from "lucide-react-native";
import {
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import { EmptyState, FieldLabel, SectionCard, SectionEyebrow } from "../../../../components/ui";
import type { AppSettings } from "../../../../storage/settings";
import { PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { ModePills } from "../shared/components";
import { RecordRow } from "../shared/homeParts";
import { HomeBalanceCards } from "./HomeBalanceCards";
import { HomeMainHeader } from "./HomeMainHeader";
import type {
  ActivityBalanceFilter,
  ActivityDateFilter,
  ActivityStateFilter,
  HomeBalances,
  HomeRecord,
  RecordActionTarget,
} from "./homeTypes";
import { screenStyles } from "../shared/styles";

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
  setFiltersExpanded: (value: boolean | ((current: boolean) => boolean)) => void;
  activityStateFilter: ActivityStateFilter;
  setActivityStateFilter: (value: ActivityStateFilter) => void;
  activityBalanceFilter: ActivityBalanceFilter;
  setActivityBalanceFilter: (value: ActivityBalanceFilter) => void;
  activityDateFilter: ActivityDateFilter;
  setActivityDateFilter: (value: ActivityDateFilter) => void;
  visibleSplitCount: number;
  filteredSplitRecordsLength: number;
  onIncreaseVisibleCount: () => void;
  pagedSplitRecords: HomeRecord[];
  getSplitReminderLabel: (record: HomeRecord) => string | undefined;
  onOpenActions: (target: RecordActionTarget) => void;
}) {
  const { t } = useTranslation();

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
                      { key: "somethingDue", label: t("home.filter.somethingDue") },
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
    </YStack>
  );
}
