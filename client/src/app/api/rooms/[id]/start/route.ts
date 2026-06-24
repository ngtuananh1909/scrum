import { NextResponse } from 'next/server';
import { startGame, sanitizeRoomForPlayer } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, roles } = await request.json();

    if (!playerId) {
      return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });
    }

    const result = await startGame(id, playerId, roles);

    if (!result) {
      return NextResponse.json({ error: 'Cannot start game' }, { status: 400 });
    }

    return NextResponse.json({
      ...result,
      room: sanitizeRoomForPlayer(result.room, playerId),
    });
  } catch (error) {
    console.error('[api/rooms/[id]/start POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
