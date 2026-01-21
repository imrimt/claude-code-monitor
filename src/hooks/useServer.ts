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
    let serverInfo: ServerInfo | null = null;
    let isMounted = true;

    async function startServer() {
      try {
        serverInfo = await createMobileServer(port);
        if (isMounted) {
          setUrl(serverInfo.url);
          setQrCode(serverInfo.qrCode);
          setActualPort(serverInfo.port);
          setLoading(false);
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
      if (serverInfo) {
        serverInfo.stop();
      }
    };
  }, [port]);

  return { url, qrCode, port: actualPort, loading, error };
}
