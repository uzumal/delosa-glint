import { useCallback, useEffect, useState } from "react";
import { LogEntry } from "@/lib/types";
import { StorageHelper } from "@/lib/storage";

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const stored = await StorageHelper.getLogs();
    setLogs(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clearLogs = useCallback(async () => {
    await StorageHelper.clearLogs();
    await refresh();
  }, [refresh]);

  return { logs, loading, clearLogs, refresh };
}
