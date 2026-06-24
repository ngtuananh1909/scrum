import { NextResponse } from 'next/server';
import { skillPmOverride, sanitizeRoomForPlayer } from '@/lib/store';

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

    const room = await skillPmOverride(id, playerId, playerIds);

    if (!room) {
      return NextResponse.json({ error: 'Cannot use PM override' }, { status: 400 });
    }

    return NextResponse.json({ room: sanitizeRoomForPlayer(room, playerId) });
  } catch (error) {
    console.error('[api/rooms/[id]/skill-pm-override POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
