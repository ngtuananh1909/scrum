import { NextResponse } from 'next/server';
import { subscribeToRoom, getRoom } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial room state
      const room = getRoom(id);
      if (room) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'init', room })}\n\n`));
      }

      // Subscribe to room updates
      const unsubscribe = subscribeToRoom(id, (updatedRoom) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'update', room: updatedRoom })}\n\n`));
        } catch {
          // Client disconnected
        }
      });

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
