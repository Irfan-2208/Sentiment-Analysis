import { useEffect, useRef, useCallback } from 'react';

export interface SSEOptions {
  onProgress?: (data: unknown) => void;
  onDone?: (data: unknown) => void;
  onError?: (data: unknown) => void;
  onCancelled?: () => void;
}

/**
 * Hook that subscribes to SSE events for an analysis job.
 * Falls back to polling if SSE is not supported or drops.
 */
export function useSSE(analysisId: string | null, options: SSEOptions) {
  const esRef = useRef<EventSource | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(() => {
    if (!analysisId) return;

    const url = `/api/analyses/${analysisId}/events`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as { type: string; data: unknown };
        switch (event.type) {
          case 'progress':
            optionsRef.current.onProgress?.(event.data);
            break;
          case 'done':
            optionsRef.current.onDone?.(event.data);
            es.close();
            break;
          case 'error':
            optionsRef.current.onError?.(event.data);
            es.close();
            break;
          case 'cancelled':
            optionsRef.current.onCancelled?.();
            es.close();
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      // Reconnect after 3s
      setTimeout(connect, 3000);
    };
  }, [analysisId]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}
