import { NextResponse } from 'next/server';
import { voteExecution } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, vote } = await request.json();

    if (!playerId || !vote) {
      return NextResponse.json({ error: 'Missing playerId or vote' }, { status: 400 });
    }

    const room = await voteExecution(id, playerId, vote);

    if (!room) {
      return NextResponse.json({ error: 'Cannot vote' }, { status: 400 });
    }

    return NextResponse.json({
      room,
      ack: { vote, at: Date.now(), phase: 'execution' },
    });
  } catch (error) {
    console.error('[api/rooms/[id]/vote-execution POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
