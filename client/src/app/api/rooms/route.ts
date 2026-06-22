import { NextResponse } from 'next/server';
import { createRoom } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const { roomId, playerName, playerId } = await request.json();

    if (!roomId || !playerName || !playerId) {
      return NextResponse.json(
        { error: 'Missing roomId, playerName, or playerId' },
        { status: 400 }
      );
    }

    const result = await createRoom(roomId, playerName, playerId);

    if (!result) {
      return NextResponse.json({ error: 'Cannot create room (already exists?)' }, { status: 400 });
    }

    return NextResponse.json({
      roomId: result.room.id,
      playerId: result.player.id,
      room: result.room,
      player: result.player,
    });
  } catch (error) {
    console.error('[api/rooms POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
