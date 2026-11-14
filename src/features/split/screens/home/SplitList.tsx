import { FlatList, Pressable, View, type FlatListProps } from "react-native";
import { Text as TamaguiText, YStack as TamaguiYStack } from "tamagui";

import { EmptyState } from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import type { AppSettings } from "../../../../storage/settings";
import { PALETTE } from "../../../../theme/palette";
import { RecordRow } from "../shared/homeParts";
import type { RecordRowModel } from "../shared/recordRowModel";
import type { HomeRecord, RecordActionTarget } from "./homeTypes";
import { SplitListLoading } from "./SplitListLoading";

type SplitRow = HomeRecord | RecordRowModel;
type Props = {
  records: SplitRow[];
  settings: AppSettings;
  getSplitReminderLabel: (record: HomeRecord) => string | undefined;
  getModelReminderLabel?: (id: string) => string | undefined;
  onOpenActions: (target: RecordActionTarget) => void;
  onOpenRecord?: (id: string) => void;
  loading: boolean;
  error: boolean;
  onRetry?: () => void;
  emptyTitle: string;
  listProps?: Omit<FlatListProps<SplitRow>, "data" | "renderItem" | "keyExtractor" | "ListEmptyComponent" | "ListFooterComponent" | "ItemSeparatorComponent">;
};

const Text = TamaguiText as any;
const YStack = TamaguiYStack as any;

export function SplitList({ records, settings, getSplitReminderLabel, getModelReminderLabel, onOpenActions, onOpenRecord, loading, error, onRetry, emptyTitle, listProps }: Props) {
  const { t } = useTranslation();
  const row = (record: SplitRow) => (
    <RecordRow
      record={record}
      ownerName={settings.ownerName}
      settings={settings}
      reminderLabel={"values" in record ? getSplitReminderLabel(record) : getModelReminderLabel?.(record.id)}
      onOpenActions={onOpenActions}
      onOpenRecord={onOpenRecord}
    />
  );
  const retry = (
    <Pressable accessibilityRole="button" accessibilityLabel={t("app.error.retry")} onPress={onRetry}>
      <Text color={PALETTE.danger}>{t("home.splitsLoadFailed")} {t("app.error.retry")}</Text>
    </Pressable>
  );
  const empty = loading ? <SplitListLoading /> : error ? retry : (
    <EmptyState title={emptyTitle} description={t("home.noSplitsDescription")} />
  );

  if (!listProps) {
    if (!records.length) return empty;
    if (error) return retry;
    return <YStack gap="$3">{records.map((record) => <View key={record.id}>{row(record)}</View>)}</YStack>;
  }

  return (
    <FlatList
      {...listProps}
      data={records}
      keyExtractor={(record) => record.id}
      renderItem={({ item }) => row(item)}
      ItemSeparatorComponent={() => <View style={{ height: 13 }} />}
      ListEmptyComponent={empty}
      ListFooterComponent={records.length > 0 && (error || loading) ? (error ? retry : <SplitListLoading compact />) : null}
    />
  );
}
