import { withAuthenticatedResponse } from '@/server/http';
import { roomService } from '@/server/room-service';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuthenticatedResponse(request, async (authUserId) => {
    const { id } = await params;
    return roomService().snapshot(id, authUserId);
  });
}
