import { useCallback, useEffect, useState } from "react";

export function usePortalData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const retry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load this part of your record.");
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loader()
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "We could not load this part of your record."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loader]);

  return { data, loading, error, retry };
}

