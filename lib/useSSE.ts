'use client';

import { useEffect, useRef } from 'react';
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
  // Refs for values that may change between renders but shouldn't re-run the
  // effect — we don't want to tear down and reconnect the EventSource every
  // time the parent re-renders with a fresh `onEvent` closure. Ref writes
  // live in an effect so we never mutate refs during render.
  const onEventRef = useRef(onEvent);
  const tableRef = useRef(table);
  useEffect(() => {
    onEventRef.current = onEvent;
    tableRef.current = table;
  });

  useEffect(() => {
    let es: EventSource | null = null;
    let retryDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const newEs = new EventSource('/api/events');
      es = newEs;

      newEs.onmessage = (msg) => {
        try {
          const event: SSEEvent = JSON.parse(msg.data);
          if (!tableRef.current || event.table === tableRef.current) {
            onEventRef.current(event);
          }
          retryDelay = 1000; // Reset backoff on successful message
        } catch { /* ignore malformed */ }
      };

      newEs.onerror = () => {
        newEs.close();
        if (es === newEs) es = null;
        // Reconnect with exponential backoff, max 30s
        reconnectTimer = setTimeout(() => {
          if (!cancelled && !document.hidden) connect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
    }

    function handleVisibility() {
      if (document.hidden) {
        es?.close();
        es = null;
      } else if (!es) {
        connect();
      }
    }

    connect();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
      es = null;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
}
