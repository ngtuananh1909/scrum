import { NextResponse } from 'next/server';
import { createRoom } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const { roomId, playerName } = await request.json();

    if (!roomId || !playerName) {
      return NextResponse.json({ error: 'Missing roomId or playerName' }, { status: 400 });
    }

    const { room, player } = createRoom(roomId, playerName);

    return NextResponse.json({ roomId: room.id, playerId: player.id, room, player });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
