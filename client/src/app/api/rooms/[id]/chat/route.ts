import { NextResponse } from 'next/server';
import { authenticatedUserId, AuthenticationError } from '@/server/auth';
import { RoomServiceError, roomService } from '@/server/room-service';

export const dynamic = 'force-dynamic';

type Audience = 'public' | 'bad';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUserId = await authenticatedUserId(request);
    const { id } = await params;
    const audience = parseAudience(new URL(request.url).searchParams.get('audience'));
    if (!audience) {
      return NextResponse.json({ error: 'Invalid chat audience' }, { status: 400 });
    }

    const messages = await roomService().messages(id, authUserId, audience);
    return NextResponse.json({ messages });
  } catch (error) {
    return routeError(error, 'Failed to load messages');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUserId = await authenticatedUserId(request);
    const { id } = await params;
    let body: { commandId?: unknown; text?: unknown; audience?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const commandId = typeof body.commandId === 'string' ? body.commandId : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const audience = parseAudience(body.audience);
    if (!UUID_PATTERN.test(commandId)) {
      return NextResponse.json({ error: 'A valid commandId is required' }, { status: 400 });
    }
    if (!text || text.length > 500) {
      return NextResponse.json({ error: 'Message must be 1-500 characters' }, { status: 400 });
    }
    if (!audience) {
      return NextResponse.json({ error: 'Invalid chat audience' }, { status: 400 });
    }

    const message = await roomService().sendMessage(id, authUserId, commandId, text, audience);
    return NextResponse.json({ message });
  } catch (error) {
    return routeError(error, 'Failed to send message');
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseAudience(value: unknown): Audience | null {
  if (value === null || value === undefined || value === '') return 'public';
  return value === 'public' || value === 'bad' ? value : null;
}

function routeError(error: unknown, fallback: string) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof RoomServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('[chat route]', error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
