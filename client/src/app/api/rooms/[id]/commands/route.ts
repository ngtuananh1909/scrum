import { readJsonObject, withAuthenticatedResponse } from '@/server/http';
import { roomService, type CommandInput } from '@/server/room-service';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuthenticatedResponse(request, async (authUserId) => {
    const { id } = await params;
    const body = await readJsonObject(request);
    return roomService().command(id, authUserId, body as unknown as CommandInput);
  });
}
