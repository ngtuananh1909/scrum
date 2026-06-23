import { NextResponse } from 'next/server';
import { autoAdvancePhase } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const room = await autoAdvancePhase(id);

    if (!room) {
      return NextResponse.json({ error: 'Cannot auto-advance' }, { status: 400 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('[api/rooms/[id]/auto-advance POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}