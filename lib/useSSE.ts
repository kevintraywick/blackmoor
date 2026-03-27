'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { SSEEvent } from '@/lib/events';

/**
 * Subscribe to server-sent events. Calls `onEvent` when a matching event arrives.
 * Automatically reconnects with exponential backoff.
 *
 * @param table  Only listen for events on this table (or null for all)
 * @param onEvent  Callback when an event matches
 */
export function useSSE(
  table: string | null,
  onEvent: (event: SSEEvent) => void,
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    const es = new EventSource('/api/events');
    let retryDelay = 1000;

    es.onmessage = (msg) => {
      try {
        const event: SSEEvent = JSON.parse(msg.data);
        if (!table || event.table === table) {
          onEventRef.current(event);
        }
        retryDelay = 1000; // Reset backoff on successful message
      } catch { /* ignore malformed */ }
    };

    es.onerror = () => {
      es.close();
      // Reconnect with exponential backoff, max 30s
      setTimeout(() => {
        if (!document.hidden) {
          const newEs = connect();
          // Store for cleanup
          esRef.current = newEs;
        }
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    };

    return es;
  }, [table]);

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    esRef.current = connect();

    // Pause when tab is hidden, reconnect when visible
    function handleVisibility() {
      if (document.hidden) {
        esRef.current?.close();
        esRef.current = null;
      } else if (!esRef.current) {
        esRef.current = connect();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      esRef.current?.close();
      esRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [connect]);
}
