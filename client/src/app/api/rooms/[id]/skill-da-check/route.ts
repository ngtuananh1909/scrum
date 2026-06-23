import { NextResponse } from 'next/server';
import { skillDataAnalystCheck } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, targetId } = await request.json();

    if (!playerId || !targetId) {
      return NextResponse.json({ error: 'Missing playerId or targetId' }, { status: 400 });
    }

    const result = await skillDataAnalystCheck(id, playerId, targetId);

    if (!result) {
      return NextResponse.json({ error: 'Cannot use DA check' }, { status: 400 });
    }

    // Private result returned ONLY here.
    return NextResponse.json({
      room: result.room,
      result: result.private.result,
      targetId: result.private.targetId,
    });
  } catch (error) {
    console.error('[api/rooms/[id]/skill-da-check POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
