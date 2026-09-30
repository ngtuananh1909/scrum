import { NextResponse } from 'next/server';
import { authenticatedUserId, AuthenticationError } from '@/server/auth';
import { RoomServiceError, roomService } from '@/server/room-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUserId = await authenticatedUserId(request);
    const { id } = await params;
    const body = await readBody(request);
    if (body instanceof Response) return body;

    const status = body.status;
    if (status !== undefined && status !== 'online' && status !== 'reconnecting' && status !== 'offline') {
      return NextResponse.json({ error: 'Invalid presence status' }, { status: 400 });
    }

    // `last_seen` is the server's heartbeat clock. An offline hint must not
    // make the player appear online by refreshing that timestamp.
    await roomService().updatePresence(id, authUserId, status !== 'offline');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (!request.headers.get('content-type')?.includes('application/json')) return {};
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

function routeError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof RoomServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('[presence route]', error);
  return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
}
