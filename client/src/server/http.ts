import { AuthenticationError, authenticatedUserId } from './auth';
import { RoomServiceError } from './room-service';

const JSON_HEADERS = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 32 * 1024;

export async function withAuthenticatedResponse<T>(
  request: Request,
  operation: (authUserId: string) => Promise<T>,
): Promise<Response> {
  try {
    const authUserId = await authenticatedUserId(request);
    const result = await operation(authUserId);
    return Response.json(result, { headers: JSON_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new RoomServiceError('INVALID_JSON', 'Request body must be JSON');
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    throw new RoomServiceError('REQUEST_TOO_LARGE', 'Request body is too large', 413);
  }

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new RoomServiceError('INVALID_JSON', 'Request body must be valid JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RoomServiceError('INVALID_JSON', 'Request body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RoomServiceError('INVALID_REQUEST', `${field} is required`);
  }
  return value;
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new RoomServiceError('INVALID_REQUEST', `${field} must be a string`);
  return value;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AuthenticationError) {
    return Response.json({ code: 'UNAUTHENTICATED', error: 'A valid bearer token is required' }, { status: 401, headers: JSON_HEADERS });
  }
  if (error instanceof RoomServiceError) {
    return Response.json({
      code: error.code,
      error: error.message,
      ...(error.currentPhaseVersion === undefined ? {} : { currentPhaseVersion: error.currentPhaseVersion }),
    }, { status: error.status, headers: JSON_HEADERS });
  }
  return Response.json({ code: 'INTERNAL_ERROR', error: 'Unexpected server error' }, { status: 500, headers: JSON_HEADERS });
}

export function goneResponse(): Response {
  return Response.json({
    code: 'LEGACY_ACTION_REMOVED',
    error: 'Use the authenticated room commands endpoint',
  }, { status: 410, headers: JSON_HEADERS });
}
