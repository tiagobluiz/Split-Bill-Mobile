import { useLocalSearchParams } from "expo-router";

import { SplitItemScreen } from "../../../../src/features/split/screens";

export default function SplitItemRoute() {
  const params = useLocalSearchParams<{ draftId?: string | string[]; itemId?: string | string[] }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId ?? "";
  const itemId = Array.isArray(params.itemId) ? params.itemId[0] : params.itemId ?? "";
  return <SplitItemScreen draftId={draftId} itemId={itemId} />;
}
