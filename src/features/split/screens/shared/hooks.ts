import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { useSplitStore } from "../../store";

export function useRecord(draftId: string) {
  const { records, activeRecordId, openRecord } = useSplitStore(useShallow((state) => ({
    records: state.records,
    activeRecordId: state.activeRecordId,
    openRecord: state.openRecord,
  })));
  const requestedDraftIdsRef = useRef<string[]>([]);
  const record = records.find((item) => item.id === draftId) ?? null;

  useEffect(() => {
    if (!draftId || activeRecordId === draftId || requestedDraftIdsRef.current.includes(draftId)) {
      return;
    }

    requestedDraftIdsRef.current = [...requestedDraftIdsRef.current, draftId];
    void openRecord(draftId).finally(() => {
      requestedDraftIdsRef.current = requestedDraftIdsRef.current.filter((id) => id !== draftId);
    });
  }, [activeRecordId, draftId, openRecord, record]);

  useEffect(() => {
    if (record) {
      requestedDraftIdsRef.current = [];
    }
  }, [draftId, record]);

  useEffect(() => {
    return () => {
      requestedDraftIdsRef.current = [];
    };
  }, []);

  return record;
}
