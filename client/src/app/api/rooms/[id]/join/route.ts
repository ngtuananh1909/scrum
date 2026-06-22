import { NextResponse } from 'next/server';
import { joinRoom } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerName, playerId } = await request.json();

    if (!playerName || !playerId) {
      return NextResponse.json({ error: 'Missing playerName or playerId' }, { status: 400 });
    }

    const result = await joinRoom(id, playerName, playerId);

    if (!result) {
      return NextResponse.json({ error: 'Cannot join room' }, { status: 400 });
    }

    return NextResponse.json({ room: result.room, player: result.player });
  } catch (error) {
    console.error('[api/rooms/[id]/join POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
