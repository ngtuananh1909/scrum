import { NextResponse } from 'next/server';
import { proposeTeam, sanitizeRoomForPlayer } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, playerIds } = await request.json();

    if (!playerId || !Array.isArray(playerIds)) {
      return NextResponse.json({ error: 'Missing playerId or playerIds' }, { status: 400 });
    }

    const room = await proposeTeam(id, playerId, playerIds);

    if (!room) {
      return NextResponse.json({ error: 'Cannot propose team' }, { status: 400 });
    }

    return NextResponse.json({ room: sanitizeRoomForPlayer(room, playerId) });
  } catch (error) {
    console.error('[api/rooms/[id]/propose POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
