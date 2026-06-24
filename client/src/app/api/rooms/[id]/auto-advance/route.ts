import { NextResponse } from 'next/server';
import { autoAdvancePhase, sanitizeRoomForPlayer } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const room = await autoAdvancePhase(id);

    if (!room) {
      return NextResponse.json({ error: 'Cannot auto-advance' }, { status: 400 });
    }

    // auto-advance is fired by client tick; we have a `viewerId` in the body
    // (optional). Fall back to null = strip everything if not provided.
    let viewerId: string | null = null;
    try {
      const body = (await request.json().catch(() => ({}))) as { playerId?: string };
      viewerId = body.playerId || null;
    } catch {
      // ignore
    }
    return NextResponse.json({ room: sanitizeRoomForPlayer(room, viewerId) });
  } catch (error) {
    console.error('[api/rooms/[id]/auto-advance POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
