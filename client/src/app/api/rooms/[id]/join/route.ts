import { NextResponse } from 'next/server';
import { joinRoom } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerName } = await request.json();

    if (!playerName) {
      return NextResponse.json({ error: 'Missing playerName' }, { status: 400 });
    }

    const result = joinRoom(id, playerName);

    if (!result) {
      return NextResponse.json({ error: 'Cannot join room' }, { status: 400 });
    }

    return NextResponse.json({ room: result.room, player: result.player });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
