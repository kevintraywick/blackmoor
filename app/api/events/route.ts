import { subscribe } from '@/lib/events';
import type { SSEEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send a heartbeat every 30s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      const unsubscribe = subscribe((event: SSEEvent) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Client disconnected
          clearInterval(heartbeat);
          unsubscribe();
        }
      });

      // When the client disconnects, clean up
      // Note: ReadableStream cancel is called when the response is aborted
    },
    cancel() {
      // Cleanup handled by the subscribe return value
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
