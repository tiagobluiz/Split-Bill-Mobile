import { useLocalSearchParams } from "expo-router";

import { ItemsScreen } from "../../../src/features/split/screens";

export default function ItemsRoute() {
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId ?? "";
  return <ItemsScreen draftId={draftId} />;
}
