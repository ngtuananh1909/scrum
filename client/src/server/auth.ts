import { supabaseAdmin } from '@/lib/supabase';

export class AuthenticationError extends Error {
  constructor(message = 'A valid bearer token is required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new AuthenticationError();
  return match[1];
}

/** Resolve the authenticated Supabase subject. Never accept a body playerId. */
export async function authenticatedUserId(request: Request): Promise<string> {
  const token = bearerToken(request);
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) throw new AuthenticationError();
  return data.user.id;
}
