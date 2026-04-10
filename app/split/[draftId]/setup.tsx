import { useLocalSearchParams } from "expo-router";

import { SetupScreen } from "../../../src/features/split/screens";

export default function SetupRoute() {
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId ?? "";
  return <SetupScreen draftId={draftId} />;
}
