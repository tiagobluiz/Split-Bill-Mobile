import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { useSplitStore } from "../../store";

export function useRecord(draftId: string) {
  const { records, activeRecordId, openRecord } = useSplitStore(useShallow((state) => ({
    records: state.records,
    activeRecordId: state.activeRecordId,
    openRecord: state.openRecord,
  })));
  const requestedDraftIdRef = useRef<string | null>(null);
  const record = records.find((item) => item.id === draftId) ?? null;

  useEffect(() => {
    if (!draftId || activeRecordId === draftId || requestedDraftIdRef.current === draftId) {
      return;
    }

    requestedDraftIdRef.current = draftId;
    void openRecord(draftId).finally(() => {
      if (requestedDraftIdRef.current === draftId) {
        requestedDraftIdRef.current = null;
      }
    });
  }, [activeRecordId, draftId, openRecord]);

  useEffect(() => {
    if (record) {
      requestedDraftIdRef.current = null;
    }
  }, [record]);

  return record;
}
