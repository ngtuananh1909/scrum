import { NextResponse } from 'next/server';
import { skillPmDefer } from '@/lib/store';

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

    const room = await skillPmDefer(id, playerId);

    if (!room) {
      return NextResponse.json({ error: 'Cannot defer PM override' }, { status: 400 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('[api/rooms/[id]/skill-pm-defer POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}