import { useEffect, useMemo, useRef, useState } from "react";
import { compareSplitDates } from "../../../../domain/splitDateOrder";
import type { DraftRecord } from "../../../../storage/records";
import { subscribeArchiveChanges } from "../../archiveChanges";
import { getSettlementPreview } from "../../store";
import { getHomeBalanceCardsFromEntries, getHomeBalanceEntry, type HomeBalanceCache, type HomeBalanceEntry } from "../shared/settlementUtils";
import { scanHomeBalances } from "./scanHomeBalances";

type Result = { owner: string; currency: string; entries: Map<string, HomeBalanceEntry> };

/** Keep only compact financial results after a bounded archive scan. */
export function useArchiveBalances(records: DraftRecord[], owner: string, currency: string, enabled: boolean, excludedId?: string) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const cache = useRef<HomeBalanceCache>(new WeakMap());
  const loadedRecords = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const loadedRecordsRef = useRef(loadedRecords);
  loadedRecordsRef.current = loadedRecords;

  useEffect(() => {
    const version = ++generation.current;
    if (!enabled) { setResult(null); setError(false); return; }
    const pending = new Map<string, HomeBalanceEntry | null>();
    let complete = false;
    setResult(null);
    setError(false);
    const unsubscribe = subscribeArchiveChanges((change) => {
      if (change.type === "metadata") return;
      if (change.type === "invalidate") {
        generation.current += 1;
        setResult(null);
        setError(false);
        setAttempt((value) => value + 1);
        return;
      }
      if (generation.current !== version) return;
      const id = change.type === "delete" ? change.id : change.record.id;
      let entry: HomeBalanceEntry | null;
      try {
        entry = change.type === "delete" ? null : getHomeBalanceEntry(change.record, owner, currency, getSettlementPreview, cache.current);
      } catch {
        generation.current += 1;
        setResult(null);
        setError(true);
        return;
      }
      if (!complete) pending.set(id, entry);
      if (complete) setResult((current) => {
        if (!current || current.owner !== owner || current.currency !== currency) return current;
        const entries = new Map(current.entries);
        if (entry) entries.set(id, entry); else entries.delete(id);
        return { ...current, entries };
      });
    });
    void scanHomeBalances({ ownerName: owner, currency, isCancelled: () => generation.current !== version, getLoadedRecord: (id) => loadedRecordsRef.current.get(id), cache: cache.current }).then((scanned) => {
      if (!scanned || generation.current !== version) return;
      const entries = new Map(scanned.map((entry) => [entry.id, entry]));
      for (const [id, entry] of pending) if (entry) entries.set(id, entry); else entries.delete(id);
      pending.clear();
      complete = true;
      setResult({ owner, currency, entries });
    }).catch(() => { if (generation.current === version) setError(true); });
    return () => { generation.current += 1; unsubscribe(); };
  }, [owner, currency, enabled, attempt]);

  const entries = useMemo(() => {
    if (!enabled || !result || result.owner !== owner || result.currency !== currency) return null;
    const merged = new Map(result.entries);
    for (const record of records) merged.set(record.id, getHomeBalanceEntry(record, owner, currency, getSettlementPreview, cache.current));
    if (excludedId) merged.delete(excludedId);
    return [...merged.values()].sort((left, right) => compareSplitDates(
      { id: left.id, createdAt: left.createdAt, values: { splitDate: left.splitDate } },
      { id: right.id, createdAt: right.createdAt, values: { splitDate: right.splitDate } }, true,
    ));
  }, [result, records, owner, currency, enabled, excludedId]);
  const balances = useMemo(() => entries ? getHomeBalanceCardsFromEntries(entries, currency) : null, [entries, currency]);
  return { entries, balances, error, retry: () => setAttempt((value) => value + 1) };
}
