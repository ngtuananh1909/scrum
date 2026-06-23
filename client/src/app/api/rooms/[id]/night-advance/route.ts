import { NextResponse } from 'next/server';
import { nightAdvance } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId } = await request.json().catch(() => ({}));

    const room = await nightAdvance(id, playerId);

    if (!room) {
      return NextResponse.json({ error: 'Cannot advance from night' }, { status: 400 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('[api/rooms/[id]/night-advance POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}