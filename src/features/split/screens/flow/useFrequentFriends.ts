import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { DraftRecord } from "../../../../storage/records";
import type { AppSettings } from "../../../../storage/settings";
import { subscribeArchiveChanges } from "../../archiveChanges";
import type { getFrequentFriends } from "../shared/participantUtils";
import { scanFrequentFriends } from "./scanFrequentFriends";

type Friends = ReturnType<typeof getFrequentFriends>;
type Result = { key: string; friends: Friends | null; error: boolean };

export function useFrequentFriends(activeDraftId: string, records: DraftRecord[], settings: AppSettings) {
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loaded = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  const people = settings.people ?? [];
  const peopleKey = JSON.stringify(people);
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const key = JSON.stringify([activeDraftId, settings.ownerName, settings.ownerPersonId, peopleKey]);

  useFocusEffect(useCallback(() => {
    let active = true;
    let invalidated = false;
    setResult({ key, friends: null, error: false });
    const unsubscribe = subscribeArchiveChanges((change) => {
      if (change.type === "metadata") return;
      if (change.type === "upsert" && change.record.id === activeDraftId) return;
      if (change.type === "delete" && change.id === activeDraftId) return;
      invalidated = true;
      setAttempt((value) => value + 1);
    });
    void scanFrequentFriends({ activeDraftId, ownerName: settings.ownerName, ownerPersonId: settings.ownerPersonId, people: peopleRef.current,
      getLoadedRecord: (id) => loadedRef.current.get(id), isCancelled: () => !active || invalidated,
    }).then((friends) => {
      if (active && !invalidated && friends) setResult({ key, friends, error: false });
    }).catch(() => { if (active && !invalidated) setResult({ key, friends: null, error: true }); });
    return () => { active = false; unsubscribe(); };
  }, [activeDraftId, settings.ownerName, settings.ownerPersonId, key, attempt]));

  return { friends: result?.key === key ? result.friends : null, error: result?.key === key && result.error, retry: () => setAttempt((value) => value + 1) };
}
