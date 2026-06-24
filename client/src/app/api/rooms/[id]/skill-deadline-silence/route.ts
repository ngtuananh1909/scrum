import { NextResponse } from 'next/server';
import { skillDeadlineSilence, sanitizeRoomForPlayer } from '@/lib/store';

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

    const room = await skillDeadlineSilence(id, playerId);

    if (!room) {
      return NextResponse.json({ error: 'Cannot use deadline silence' }, { status: 400 });
    }

    return NextResponse.json({ room: sanitizeRoomForPlayer(room, playerId) });
  } catch (error) {
    console.error('[api/rooms/[id]/skill-deadline-silence POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
