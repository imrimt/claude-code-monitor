import { useEffect, useRef } from 'react';
import { PROCESS_SCAN_INTERVAL_MS } from '../constants.js';
import { syncProcessSessions } from '../store/file-store.js';
import { scanForCodexProcesses } from '../utils/process-scanner.js';

/**
 * React hook that polls for Codex CLI processes and syncs them into the session store.
 * The existing useSessions file watcher picks up the store changes automatically.
 */
export function useProcessScanner(enabled: boolean): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const scan = () => {
      const detected = scanForCodexProcesses();
      syncProcessSessions(detected);
    };

    // Initial scan
    scan();

    // Poll on interval
    intervalRef.current = setInterval(scan, PROCESS_SCAN_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);
}
