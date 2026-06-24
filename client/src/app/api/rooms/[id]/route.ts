import { NextResponse } from 'next/server';
import { getRoom, sanitizeRoomForPlayer } from '@/lib/store';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const room = await getRoom(id);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // GET has no authenticated viewer; strip every role.
    const safeRoom = sanitizeRoomForPlayer(room, null);
    return NextResponse.json({ room: safeRoom });
  } catch (error) {
    console.error('[api/rooms/[id] GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
