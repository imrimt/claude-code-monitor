import { useEffect, useState } from 'react';
import { createMobileServer, type ServerInfo } from '../server/index.js';

interface UseServerResult {
  url: string | null;
  qrCode: string | null;
  port: number | null;
  loading: boolean;
  error: Error | null;
}

const DEFAULT_PORT = 3456;

export function useServer(port = DEFAULT_PORT): UseServerResult {
  const [url, setUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [actualPort, setActualPort] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Use a ref-like object to track server across async boundaries
    // This prevents race condition where cleanup runs before async completes
    const serverRef: { current: ServerInfo | null } = { current: null };
    let isMounted = true;

    async function startServer() {
      try {
        const info = await createMobileServer(port);
        if (isMounted) {
          serverRef.current = info;
          setUrl(info.url);
          setQrCode(info.qrCode);
          setActualPort(info.port);
          setLoading(false);
        } else {
          // Component unmounted during async operation - stop server immediately
          info.stop();
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to start server'));
          setLoading(false);
        }
      }
    }

    startServer();

    return () => {
      isMounted = false;
      if (serverRef.current) {
        serverRef.current.stop();
      }
    };
  }, [port]);

  return { url, qrCode, port: actualPort, loading, error };
}
