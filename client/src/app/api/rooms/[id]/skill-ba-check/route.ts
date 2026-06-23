import { NextResponse } from 'next/server';
import { skillBusinessAnalystCheck } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, targetIds } = await request.json();

    if (
      !playerId ||
      !Array.isArray(targetIds) ||
      targetIds.length !== 2 ||
      typeof targetIds[0] !== 'string' ||
      typeof targetIds[1] !== 'string'
    ) {
      return NextResponse.json({ error: 'Need exactly 2 target ids' }, { status: 400 });
    }

    const result = await skillBusinessAnalystCheck(id, playerId, [
      targetIds[0],
      targetIds[1],
    ]);

    if (!result) {
      return NextResponse.json({ error: 'Cannot use BA check' }, { status: 400 });
    }

    // Private result returned ONLY in this response — never stored in room.state.
    return NextResponse.json({ room: result.room, result: result.private.result });
  } catch (error) {
    console.error('[api/rooms/[id]/skill-ba-check POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
