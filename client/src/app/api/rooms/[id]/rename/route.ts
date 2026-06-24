import { NextResponse } from 'next/server';
import { renamePlayer, sanitizeRoomForPlayer } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, newName } = await request.json();

    if (!playerId || !newName) {
      return NextResponse.json({ error: 'Missing playerId or newName' }, { status: 400 });
    }

    const room = await renamePlayer(id, playerId, newName);

    if (!room) {
      return NextResponse.json({ error: 'Cannot rename player' }, { status: 400 });
    }

    return NextResponse.json({ room: sanitizeRoomForPlayer(room, playerId) });
  } catch (error) {
    console.error('[api/rooms/[id]/rename POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
