import { NextResponse } from 'next/server';
import { nightZeroComplete } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, ttsTargetId } = await request.json();

    if (!playerId) {
      return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });
    }

    const room = await nightZeroComplete(id, playerId, ttsTargetId ?? null);

    if (!room) {
      return NextResponse.json({ error: 'Cannot complete night zero' }, { status: 400 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('[api/rooms/[id]/skill-night-zero POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
