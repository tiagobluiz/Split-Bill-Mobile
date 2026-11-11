import { useCallback } from "react";
import { useFocusEffect } from "expo-router";

import { useSplitStore } from "../../store";

export function useRecord(draftId: string) {
  const record = useSplitStore((state) => state.records.find((item) => item.id === draftId) ?? null);
  const openRecord = useSplitStore((state) => state.openRecord);

  useFocusEffect(useCallback(() => {
    let focused = true;
    if (draftId) {
      void openRecord(draftId, () => focused).catch((error) => {
        console.warn("Failed to open split", error);
      });
    }
    return () => { focused = false; };
  }, [draftId, openRecord]));

  return record;
}
