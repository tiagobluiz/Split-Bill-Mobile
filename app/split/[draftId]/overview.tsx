import { useLocalSearchParams } from "expo-router";

import { ReviewScreen } from "../../../src/features/split/screens";

export default function OverviewRoute() {
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId ?? "";
  return <ReviewScreen draftId={draftId} />;
}
