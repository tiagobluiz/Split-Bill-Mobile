import { useEffect, useMemo, useRef, useState } from "react";

import type { DraftRecord } from "../../../../storage/records";
import { getSettlementPreview } from "../../store";
import { getHomeBalanceCards, type HomeBalanceCache } from "../shared/settlementUtils";
import type { HomeBalances } from "./homeTypes";

const BATCH_SIZE = 25;

type BalanceResult = {
  records: DraftRecord[];
  ownerName: string;
  currency: string;
  balances: HomeBalances;
};

export function useHomeBalances(records: DraftRecord[], ownerName: string, currency: string, enabled: boolean) {
  const cache = useRef<HomeBalanceCache>(new WeakMap());
  const [result, setResult] = useState<BalanceResult | null>(null);
  const immediate = useMemo(() => enabled && records.length <= BATCH_SIZE
    ? getHomeBalanceCards(records, ownerName, currency, getSettlementPreview, cache.current)
    : null, [records, ownerName, currency, enabled]);

  useEffect(() => {
    if (!enabled || records.length <= BATCH_SIZE) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let offset = 0;

    const calculateBatch = () => {
      if (cancelled) return;
      const end = Math.min(offset + BATCH_SIZE, records.length);
      getHomeBalanceCards(records.slice(offset, end), ownerName, currency, getSettlementPreview, cache.current);
      offset = end;
      if (offset < records.length) {
        timer = setTimeout(calculateBatch, 0);
        return;
      }
      setResult({
        records,
        ownerName,
        currency,
        balances: getHomeBalanceCards(records, ownerName, currency, getSettlementPreview, cache.current),
      });
    };

    timer = setTimeout(calculateBatch, 0);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [records, ownerName, currency, enabled]);

  if (immediate) return immediate;
  return result?.records === records && result.ownerName === ownerName && result.currency === currency
    ? result.balances
    : null;
}
