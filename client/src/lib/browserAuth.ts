'use client';

import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabaseBrowser';

export interface AuthSession {
  access_token: string;
  user: { id: string };
}

export interface BrowserSessionIdentity {
  userId: string;
  accessToken: string;
}

type BrowserAuthApi = Pick<SupabaseClient['auth'], 'getSession' | 'signInAnonymously'>;
type SessionProvider = () => Promise<BrowserSessionIdentity>;
type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Reuse Supabase's persisted session and create one anonymous identity when none exists. */
export function createBrowserSessionManager(getAuth: () => BrowserAuthApi): SessionProvider {
  let inFlight: Promise<BrowserSessionIdentity> | null = null;

  return () => {
    if (!inFlight) {
      const request = (async () => {
        const auth = getAuth();
        const current = await auth.getSession();
        if (current.error) throw current.error;

        let session = current.data.session as AuthSession | null;
        if (!session) {
          const created = await auth.signInAnonymously();
          if (created.error) throw created.error;
          session = created.data.session as AuthSession | null;
        }

        if (!session?.access_token || !session.user?.id) {
          throw new Error('Supabase did not return an authenticated browser session.');
        }
        return { userId: session.user.id, accessToken: session.access_token };
      })();

      inFlight = request;
      void request.then(
        () => {
          if (inFlight === request) inFlight = null;
        },
        () => {
          if (inFlight === request) inFlight = null;
        }
      );
    }

    return inFlight;
  };
}

let defaultSessionManager: SessionProvider | null = null;

export function ensureBrowserSession(): Promise<BrowserSessionIdentity> {
  defaultSessionManager ??= createBrowserSessionManager(() => getSupabase().auth);
  return defaultSessionManager();
}

/** Build an API fetcher that always uses the current Supabase bearer token. */
export function createAuthenticatedFetch(
  getSession: SessionProvider,
  fetchImpl: FetchImplementation = fetch
): FetchImplementation {
  return async (input, init = {}) => {
    const session = await getSession();
    const requestHeaders =
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined;
    const headers = new Headers(requestHeaders);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.set('Authorization', `Bearer ${session.accessToken}`);

    return fetchImpl(input, { ...init, headers });
  };
}

export const authenticatedFetch = createAuthenticatedFetch(ensureBrowserSession);

export type BrowserAuthListener = (event: AuthChangeEvent, session: Session | null) => void;

export function subscribeToBrowserAuth(listener: BrowserAuthListener): () => void {
  const { data } = getSupabase().auth.onAuthStateChange(listener);
  return () => data.subscription.unsubscribe();
}
