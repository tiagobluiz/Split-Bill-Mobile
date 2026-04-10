import { useLocalSearchParams } from "expo-router";

import { ParticipantsScreen } from "../../../src/features/split/screens";

export default function ParticipantsRoute() {
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId ?? "";
  return <ParticipantsScreen draftId={draftId} />;
}
