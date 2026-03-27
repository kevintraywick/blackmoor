/**
 * Server-Sent Events (SSE) broadcast system.
 *
 * API routes call `broadcast(table, id, action)` after mutations.
 * The /api/events endpoint streams these to connected clients.
 * Clients use the `useSSE` hook to subscribe and react to changes.
 */

export interface SSEEvent {
  table: string;
  id: string;
  action: 'create' | 'patch' | 'delete';
}

type Listener = (event: SSEEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function broadcast(table: string, id: string, action: SSEEvent['action']): void {
  const event: SSEEvent = { table, id, action };
  for (const listener of listeners) {
    try { listener(event); } catch { /* don't let one bad listener break others */ }
  }
}
