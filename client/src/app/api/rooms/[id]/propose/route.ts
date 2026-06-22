import { NextResponse } from 'next/server';
import { proposeTeam } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, playerIds } = await request.json();

    if (!playerId || !playerIds) {
      return NextResponse.json({ error: 'Missing playerId or playerIds' }, { status: 400 });
    }

    const room = proposeTeam(id, playerId, playerIds);

    if (!room) {
      return NextResponse.json({ error: 'Cannot propose team' }, { status: 400 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
