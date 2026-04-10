import { useLocalSearchParams } from "expo-router";

import { PasteImportScreen } from "../../../src/features/split/screens";

export default function PasteRoute() {
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId ?? "";
  return <PasteImportScreen draftId={draftId} />;
}
