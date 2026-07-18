import { NextResponse } from 'next/server';
import { getRoleInfo, sanitizeRoomForPlayer } from '@/lib/store';

// Returns the caller's private role information after the game starts. The
// client needs this in addition to the sanitized Realtime room state so SM can
// receive its faction map without exposing everybody's role names.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const playerId = new URL(request.url).searchParams.get('playerId');
    if (!playerId) {
      return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });
    }

    const result = await getRoleInfo(id, playerId);
    if (!result || !result.role) {
      return NextResponse.json({ error: 'Role information is unavailable' }, { status: 404 });
    }

    return NextResponse.json({
      ...result,
      room: sanitizeRoomForPlayer(result.room, playerId),
    });
  } catch (error) {
    console.error('[api/rooms/[id]/role-info GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
