import { useLocalSearchParams } from "expo-router";

import { AssignItemScreen } from "../../../../src/features/split/screens";

export default function AssignItemRoute() {
  const params = useLocalSearchParams<{ draftId?: string | string[]; itemId?: string | string[] }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId ?? "";
  const itemId = Array.isArray(params.itemId) ? params.itemId[0] : params.itemId ?? "";
  return <AssignItemScreen draftId={draftId} itemId={itemId} />;
}
