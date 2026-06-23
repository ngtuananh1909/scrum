import { NextResponse } from 'next/server';
import { advanceFromDiscussion } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId } = await request.json();

    if (!playerId) {
      return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });
    }

    const room = await advanceFromDiscussion(id, playerId);

    if (!room) {
      return NextResponse.json({ error: 'Cannot advance from discussion' }, { status: 400 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('[api/rooms/[id]/advance-discussion POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}