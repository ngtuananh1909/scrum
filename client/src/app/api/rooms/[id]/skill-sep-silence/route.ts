import { NextResponse } from 'next/server';
import { skillSepSilence, sanitizeRoomForPlayer } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, targetId } = await request.json();

    if (!playerId || !targetId) {
      return NextResponse.json({ error: 'Missing playerId or targetId' }, { status: 400 });
    }

    const room = await skillSepSilence(id, playerId, targetId);

    if (!room) {
      return NextResponse.json({ error: 'Cannot silence' }, { status: 400 });
    }

    return NextResponse.json({ room: sanitizeRoomForPlayer(room, playerId) });
  } catch (error) {
    console.error('[api/rooms/[id]/skill-sep-silence POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
