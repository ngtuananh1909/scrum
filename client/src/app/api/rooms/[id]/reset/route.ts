import { NextResponse } from 'next/server';
import { resetRoom, sanitizeRoomForPlayer } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId } = await request.json();

    if (!playerId) {
      return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });
    }

    const room = await resetRoom(id, playerId);
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found or player not in room' },
        { status: 404 }
      );
    }

    return NextResponse.json({ room: sanitizeRoomForPlayer(room, playerId) });
  } catch (error) {
    console.error('[api/rooms/[id]/reset POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
