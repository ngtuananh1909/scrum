import { readJsonObject, requiredString, optionalString, withAuthenticatedResponse } from '@/server/http';
import { roomService } from '@/server/room-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return withAuthenticatedResponse(request, async (authUserId) => {
    const body = await readJsonObject(request);
    return roomService().createRoom(
      requiredString(body.roomId, 'roomId'),
      requiredString(body.playerName, 'playerName'),
      authUserId,
      optionalString(body.commandId, 'commandId'),
    );
  });
}
