import { useCallback, useEffect, useRef, useState } from "react";

import { listSplitSummaries, type SplitListCursor, type SplitListQuery, type SplitListSummary } from "../../../../storage/splitList";
import { subscribeArchiveChanges } from "../../archiveChanges";

type PageQuery = Omit<SplitListQuery, "limit" | "cursor">;
type PageState = {
  queryKey?: string;
  records: SplitListSummary[];
  nextCursor: SplitListCursor | null;
  loading: boolean;
  error: boolean;
};

const EMPTY: PageState = { records: [], nextCursor: null, loading: false, error: false };
const PAGE_SIZE = 20;

/** Retain only pages for the current query and ignore stale requests. */
export function useSplitListPages(query: PageQuery | null, revision: unknown, pageSize = PAGE_SIZE, enabled = true) {
  const [state, setState] = useState<PageState>(EMPTY);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const loading = useRef(false);
  const cursor = useRef<SplitListCursor | null>(null);
  const activeQueryKey = useRef<string | undefined>(undefined);
  const currentQuery = useRef<PageQuery | null>(query);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const dirty = useRef(true);
  currentQuery.current = query;
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    return subscribeArchiveChanges(() => {
      generation.current += 1;
      dirty.current = true;
      loading.current = false;
      cursor.current = null;
      setState(EMPTY);
      if (enabledRef.current) setAttempt((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!dirty.current && activeQueryKey.current === queryKey) return;
    dirty.current = false;
    const version = ++generation.current;
    activeQueryKey.current = queryKey;
    cursor.current = null;
    loading.current = false;
    const activeQuery = currentQuery.current;
    if (!activeQuery) {
      setState({ ...EMPTY, queryKey });
      return () => { generation.current += 1; };
    }
    loading.current = true;
    setState({ ...EMPTY, queryKey, loading: true });
    void listSplitSummaries({ ...activeQuery, limit: pageSize }).then((page) => {
      if (generation.current !== version) return;
      cursor.current = page.nextCursor;
      loading.current = false;
      setState({ queryKey, records: page.records, nextCursor: page.nextCursor, loading: false, error: false });
    }).catch(() => {
      if (generation.current !== version) return;
      loading.current = false;
      setState({ ...EMPTY, queryKey, error: true });
    });
    return () => {
      generation.current += 1;
      if (loading.current) dirty.current = true;
    };
  }, [queryKey, revision, attempt, pageSize, enabled]);

  const loadMore = useCallback((limit = pageSize) => {
    const activeQuery = currentQuery.current;
    const nextCursor = cursor.current;
    if (!activeQuery || JSON.stringify(activeQuery) !== activeQueryKey.current || !nextCursor || loading.current) return;
    const version = generation.current;
    loading.current = true;
    setState((current) => ({ ...current, loading: true, error: false }));
    void listSplitSummaries({ ...activeQuery, limit, cursor: nextCursor }).then((page) => {
      if (generation.current !== version) return;
      cursor.current = page.nextCursor;
      loading.current = false;
      setState((current) => ({ ...current, records: [...current.records, ...page.records], nextCursor: page.nextCursor, loading: false, error: false }));
    }).catch(() => {
      if (generation.current !== version) return;
      loading.current = false;
      setState((current) => ({ ...current, loading: false, error: true }));
    });
  }, [pageSize]);

  const reload = useCallback(() => { dirty.current = true; setAttempt((current) => current + 1); }, []);
  const visible = state.queryKey === queryKey ? state : { ...EMPTY, loading: query !== null };
  return { ...visible, loadMore, reload };
}
