import { NextResponse } from 'next/server';
import { authenticatedUserId, AuthenticationError } from '@/server/auth';
import { RoomServiceError, roomService } from '@/server/room-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUserId = await authenticatedUserId(request);
    const { id } = await params;
    const result = await roomService().endReveal(id, authUserId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof RoomServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('[end-reveal route]', error);
    return NextResponse.json({ error: 'Failed to load role reveal' }, { status: 500 });
  }
}
