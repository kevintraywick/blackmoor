'use client';

import { useState, useRef, useCallback } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Debounced autosave hook that accumulates pending changes.
 *
 * Unlike a naive debounce that replaces the pending patch on each call,
 * this hook merges successive patches so rapid edits across multiple
 * fields are never silently dropped.
 *
 * @param url  API endpoint (or a function that returns one)
 * @param delay  Debounce delay in ms (default 600)
 */
export function useAutosave(
  url: string | (() => string),
  delay = 600,
): {
  save: (patch: Record<string, unknown>) => void;
  saveNow: (patch: Record<string, unknown>) => Promise<boolean>;
  status: SaveStatus;
} {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Record<string, unknown>>({});

  const resolveUrl = useCallback(
    () => (typeof url === 'function' ? url() : url),
    [url],
  );

  const flush = useCallback(
    async (patch: Record<string, unknown>): Promise<boolean> => {
      try {
        const res = await fetch(resolveUrl(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error();
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
        return true;
      } catch {
        setStatus('failed');
        return false;
      }
    },
    [resolveUrl],
  );

  const save = useCallback(
    (patch: Record<string, unknown>) => {
      // Accumulate into pending ref — never drops earlier fields
      Object.assign(pending.current, patch);
      setStatus('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const merged = { ...pending.current };
        pending.current = {};
        await flush(merged);
      }, delay);
    },
    [flush, delay],
  );

  const saveNow = useCallback(
    async (patch: Record<string, unknown>): Promise<boolean> => {
      // Cancel any pending debounced save and merge
      if (timer.current) clearTimeout(timer.current);
      const merged = { ...pending.current, ...patch };
      pending.current = {};
      setStatus('saving');
      return flush(merged);
    },
    [flush],
  );

  return { save, saveNow, status };
}
