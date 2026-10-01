import { readJsonObject, requiredString, withAuthenticatedResponse } from '@/server/http';
import { RoomServiceError, roomService } from '@/server/room-service';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuthenticatedResponse(request, async (authUserId) => {
    const { id } = await params;
    const body = await readJsonObject(request);
    if (body.spectator !== undefined && typeof body.spectator !== 'boolean') {
      throw new RoomServiceError('INVALID_REQUEST', 'spectator must be a boolean');
    }
    return roomService().joinRoom(
      id,
      requiredString(body.playerName, 'playerName'),
      authUserId,
      body.spectator === true,
    );
  });
}
