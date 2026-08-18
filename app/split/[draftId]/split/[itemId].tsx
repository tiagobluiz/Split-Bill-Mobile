import { useLocalSearchParams } from "expo-router";

import { SplitItemScreen } from "../../../../src/features/split/screens";

export default function SplitItemRoute() {
  const params = useLocalSearchParams<{
    draftId?: string | string[];
    itemId?: string | string[];
    skippedItemIds?: string | string[];
  }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId ?? "";
  const itemId = Array.isArray(params.itemId) ? params.itemId[0] : params.itemId ?? "";
  const skippedItemIdsValue = Array.isArray(params.skippedItemIds)
    ? params.skippedItemIds[0]
    : params.skippedItemIds ?? "";
  const skippedItemIds = skippedItemIdsValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return (
    <SplitItemScreen
      draftId={draftId}
      itemId={itemId}
      skippedItemIds={skippedItemIds}
    />
  );
}
