import { Alert, Pressable, ScrollView, View } from "react-native";
import { ArrowRight, Plus } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import { EmptyState } from "../../../../components/ui";
import type { AppSettings } from "../../../../storage/settings";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { RecordRow } from "../shared/homeParts";
import type { RecordRowModel } from "../shared/recordRowModel";
import { HomeMainHeader } from "./HomeMainHeader";
import { HomeBalanceCards } from "./HomeBalanceCards";
import { SplitListLoading } from "./SplitListLoading";
import type { HomeBalances, HomeRecord, RecordActionTarget } from "./homeTypes";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function HomeHomeTabContent({
  topInset,
  footerInsetBottom,
  isCreatingSplit,
  onStartSplit,
  settings,
  balances,
  locale,
  recentRecords,
  onViewAllSplits,
  getSplitReminderLabel,
  onOpenActions,
  onOpenRecord,
  getModelReminderLabel,
  listLoading = false,
  listError = false,
  onRetry,
  balanceError = false,
  onRetryBalances,
}: {
  topInset: number;
  footerInsetBottom: number;
  isCreatingSplit: boolean;
  onStartSplit: () => Promise<void>;
  settings: AppSettings;
  balances: HomeBalances | null;
  locale: string;
  recentRecords: (HomeRecord | RecordRowModel)[];
  onViewAllSplits: () => void;
  getSplitReminderLabel: (record: HomeRecord) => string | undefined;
  onOpenActions: (target: RecordActionTarget) => void;
  onOpenRecord?: (id: string) => void;
  getModelReminderLabel?: (id: string) => string | undefined;
  listLoading?: boolean;
  listError?: boolean;
  onRetry?: () => void;
  balanceError?: boolean;
  onRetryBalances?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <YStack flex={1}>
      <HomeMainHeader topInset={topInset} />
      <ScrollView
        testID="home-tab-scroll"
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.mainTabScrollContent,
          { paddingBottom: footerInsetBottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
          <View style={screenStyles.ctaHalo}>
            <Pressable
              style={[screenStyles.homeCta, isCreatingSplit ? { opacity: 0.72 } : null]}
              disabled={isCreatingSplit}
              onPress={() => {
                void onStartSplit().catch((error) => {
                  console.warn("Failed to create split", error);
                  Alert.alert(
                    t("home.couldNotCreateSplit"),
                    error instanceof Error && error.message
                      ? error.message
                      : t("common.tryAgain"),
                  );
                });
              }}
            >
              <View style={screenStyles.homeCtaIconWrap}>
                <Plus color={PALETTE.primary} size={20} />
              </View>
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={26}
                color={PALETTE.onPrimary}
                letterSpacing={-1}
              >
                {t("home.startSplit", undefined, { maxLength: 22 })}
              </Text>
            </Pressable>
          </View>
          {(settings.balanceFeatureEnabled ?? true) ? (
            <HomeBalanceCards
              balances={balances}
              locale={locale}
              settings={settings}
              error={balanceError}
              onRetry={onRetryBalances}
            />
          ) : null}
          <YStack gap="$4">
            <XStack justifyContent="space-between" alignItems="center">
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={28}
                color={PALETTE.onSurfaceVariant}
                letterSpacing={-1.2}
              >
                {t("home.recent")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.viewAllSplits")}
                onPress={onViewAllSplits}
                style={{ flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44 }}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={16}
                  color={PALETTE.primary}
                >
                  {t("home.viewAll")}
                </Text>
                <ArrowRight color={PALETTE.primary} size={19} />
              </Pressable>
            </XStack>
            {listLoading && recentRecords.length === 0 ? (
              <SplitListLoading />
            ) : listError ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t("app.error.retry")} onPress={onRetry}>
                <Text color={PALETTE.danger}>{t("home.splitsLoadFailed")} {t("app.error.retry")}</Text>
              </Pressable>
            ) : recentRecords.length === 0 ? (
              <EmptyState
                title={t("home.noSplitsTitle")}
                description={t("home.noSplitsDescription")}
              />
            ) : (
              <YStack gap="$3">
                {recentRecords.map((record) => (
                  <RecordRow
                    key={record.id}
                    record={record}
                    ownerName={settings.ownerName}
                    settings={settings}
                    reminderLabel={"values" in record ? getSplitReminderLabel(record) : getModelReminderLabel?.(record.id)}
                    onOpenActions={onOpenActions}
                    onOpenRecord={onOpenRecord}
                  />
                ))}
              </YStack>
            )}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
