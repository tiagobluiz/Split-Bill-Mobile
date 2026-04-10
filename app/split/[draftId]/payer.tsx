import { useLocalSearchParams } from "expo-router";

import { PayerScreen } from "../../../src/features/split/screens";

export default function PayerRoute() {
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId ?? "";
  return <PayerScreen draftId={draftId} />;
}
