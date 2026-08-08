/**
 * useDataSources
 * Polls GET /api/data-sources every 3 seconds so the monitoring page
 * shows real field schemas, record counts, and live throughput derived
 * from the actual CSV files and WebSocket feed counter.
 */

import { useState, useEffect, useCallback } from "react";
import type { DataSource } from "@/types/sentinel";

const API_URL = "http://localhost:8000/api/data-sources";
const POLL_INTERVAL_MS = 3000;

interface UseDataSourcesResult {
  sources: DataSource[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDataSources(): UseDataSourcesResult {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DataSource[] = await res.json();
      setSources(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach backend");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Polling every 3 s
  useEffect(() => {
    const id = setInterval(fetchSources, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchSources]);

  return { sources, loading, error, refetch: fetchSources };
}
