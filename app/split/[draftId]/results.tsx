import { useLocalSearchParams } from "expo-router";

import { ResultsScreen } from "../../../src/features/split/screens";

export default function ResultsRoute() {
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId ?? "";
  return <ResultsScreen draftId={draftId} />;
}
