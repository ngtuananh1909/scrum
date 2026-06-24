import { NextResponse } from 'next/server';
import { createRoom, sanitizeRoomForPlayer } from '@/lib/store';

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

    // Newly-created room has no roles yet (lobby phase); sanitize for the
    // creator anyway so consistent shape is always returned.
    const safeRoom = sanitizeRoomForPlayer(result.room, playerId);

    return NextResponse.json({
      roomId: safeRoom.id,
      playerId: result.player.id,
      room: safeRoom,
      player: result.player,
    });
  } catch (error) {
    console.error('[api/rooms POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
