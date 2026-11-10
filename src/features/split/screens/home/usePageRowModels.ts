import { useEffect, useMemo, useRef, useState } from "react";
import { getRecordsByIds, type DraftRecord } from "../../../../storage/records";
import type { SplitListSummary } from "../../../../storage/splitList";
import { createRecordRowModel, type RecordRowModel, type RecordRowSettings } from "../shared/recordRowModel";

type CachedRow = { updatedAt: string; settingsKey: string; model: RecordRowModel | null };

/** Hydrate only requested pages, retaining their compact row data between renders. */
export function usePageRowModels(summaries: SplitListSummary[], loadedRecords: DraftRecord[], ownerName: string, settings: RecordRowSettings, enabled: boolean, displayRevision?: string) {
  const cache = useRef(new Map<string, CachedRow>());
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loaded = useMemo(() => new Map(loadedRecords.map((record) => [record.id, record])), [loadedRecords]);
  const settingsKey = JSON.stringify([ownerName, settings.defaultCurrency, settings.splitListAmountDisplay, settings.customCurrencies, displayRevision]);
  const summaryKey = JSON.stringify(summaries.map((entry) => [entry.id, entry.updatedAt]));

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      cache.current.clear();
      setError(false);
      setRevision((value) => value + 1);
      return;
    }
    const currentIds = new Set(summaries.map((entry) => entry.id));
    for (const id of cache.current.keys()) if (!currentIds.has(id)) cache.current.delete(id);
    for (const entry of summaries) {
      const record = loaded.get(entry.id);
      if (record) cache.current.set(entry.id, { updatedAt: entry.updatedAt, settingsKey, model: createRecordRowModel(record, ownerName, settings) });
    }
    const missing = summaries.filter((entry) => {
      if (loaded.has(entry.id)) return false;
      const cached = cache.current.get(entry.id);
      return !cached || cached.updatedAt !== entry.updatedAt || cached.settingsKey !== settingsKey;
    });
    if (!missing.length) return;
    setError(false);
    void (async () => {
      for (let offset = 0; offset < missing.length; offset += 100) {
        const batch = missing.slice(offset, offset + 100);
        const records = await getRecordsByIds(batch.map((entry) => entry.id));
        if (cancelled) return;
        const versions = new Map(batch.map((entry) => [entry.id, entry.updatedAt]));
        for (const entry of batch) cache.current.set(entry.id, { updatedAt: entry.updatedAt, settingsKey, model: null });
        for (const record of records) {
          cache.current.set(record.id, { updatedAt: versions.get(record.id)!, settingsKey, model: createRecordRowModel(record, ownerName, settings) });
        }
        setRevision((value) => value + 1);
      }
    })().catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [enabled, summaryKey, loaded, ownerName, settingsKey, attempt]);

  const rows = useMemo(() => {
    if (!enabled) return [];
    return summaries.flatMap((entry) => {
      const record = loaded.get(entry.id);
      if (record) return [createRecordRowModel(record, ownerName, settings)];
      const cached = cache.current.get(entry.id);
      return cached && cached.updatedAt === entry.updatedAt && cached.settingsKey === settingsKey && cached.model ? [cached.model] : [];
    });
  }, [enabled, summaries, loaded, ownerName, settingsKey, revision]);
  const loading = enabled && !error && summaries.some((entry) => {
    if (loaded.has(entry.id)) return false;
    const cached = cache.current.get(entry.id);
    return !cached || cached.updatedAt !== entry.updatedAt || cached.settingsKey !== settingsKey;
  });
  return { rows, loading, error, retry: () => setAttempt((value) => value + 1) };
}
