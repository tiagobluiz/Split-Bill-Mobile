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
export function useSplitListPages(query: PageQuery | null, revision: unknown, pageSize = PAGE_SIZE) {
  const [state, setState] = useState<PageState>(EMPTY);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const loading = useRef(false);
  const cursor = useRef<SplitListCursor | null>(null);
  const activeQueryKey = useRef<string | undefined>(undefined);
  const currentQuery = useRef<PageQuery | null>(query);
  currentQuery.current = query;
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    if (!currentQuery.current) return;
    return subscribeArchiveChanges(() => setAttempt((value) => value + 1));
  }, [queryKey]);

  useEffect(() => {
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
    return () => { generation.current += 1; };
  }, [queryKey, revision, attempt, pageSize]);

  const loadMore = useCallback(() => {
    const activeQuery = currentQuery.current;
    const nextCursor = cursor.current;
    if (!activeQuery || JSON.stringify(activeQuery) !== activeQueryKey.current || !nextCursor || loading.current) return;
    const version = generation.current;
    loading.current = true;
    setState((current) => ({ ...current, loading: true, error: false }));
    void listSplitSummaries({ ...activeQuery, limit: pageSize, cursor: nextCursor }).then((page) => {
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

  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  const visible = state.queryKey === queryKey ? state : { ...EMPTY, loading: query !== null };
  return { ...visible, loadMore, reload };
}
