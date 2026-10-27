import { SUPABASE_URL, SUPABASE_ANON_KEY, isBackendConfigured } from './backend-config.js';

const SESSION_KEY = 'shonen-siege-supabase-session-v1';
const baseUrl = () => SUPABASE_URL.replace(/\/$/, '');
const headers = (session, extra = {}) => {
  // Legacy anon keys are JWTs and can be used as the anonymous bearer token.
  // New publishable keys are not JWTs, so send those only via `apikey`.
  const keyIsLegacyJwt = SUPABASE_ANON_KEY.split('.').length === 3 && SUPABASE_ANON_KEY.startsWith('eyJ');
  return {
    apikey: SUPABASE_ANON_KEY,
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : keyIsLegacyJwt ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
    ...extra,
  };
};

export function getStoredSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
export function storeSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

async function request(path, { session = null, method = 'GET', body, headers: extraHeaders = {}, raw = false } = {}) {
  if (!isBackendConfigured()) throw new Error('Account features are not configured yet. Add your Supabase URL and anon key in src/backend-config.js.');
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: headers(session, {
      ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    }),
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.hint || data?.details || data?.error_description || data?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export async function signUp(email, password, username) {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined;
  const path = redirectTo ? `/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}` : '/auth/v1/signup';
  const data = await request(path, { method: 'POST', body: { email, password, data: { username } } });
  if (data?.access_token) storeSession(data);
  return data;
}
export async function signIn(email, password) {
  const data = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  storeSession(data);
  return data;
}
export async function signOut(session) {
  try { if (session) await request('/auth/v1/logout', { session, method: 'POST' }); }
  finally { storeSession(null); }
}
async function takeAuthCallbackFromUrl() {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  if (accessToken) {
    const expiresIn = Number(hash.get('expires_in') || 3600);
    const session = {
      access_token: accessToken,
      refresh_token: hash.get('refresh_token') || '',
      token_type: hash.get('token_type') || 'bearer',
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    };
    storeSession(session);
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
    return session;
  }
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  if (tokenHash && type) {
    const session = await request('/auth/v1/verify', { method: 'POST', body: { token_hash: tokenHash, type } });
    if (session?.access_token) storeSession(session);
    url.searchParams.delete('token_hash'); url.searchParams.delete('type');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    return session?.access_token ? session : null;
  }
  return null;
}

export async function restoreSession() {
  const callbackSession = await takeAuthCallbackFromUrl().catch(error => { console.warn('Could not complete auth callback:', error); return null; });
  if (callbackSession?.access_token) return callbackSession;
  const old = getStoredSession();
  if (!old?.access_token) return null;
  const expiresAt = Number(old.expires_at || 0);
  if (expiresAt && expiresAt * 1000 < Date.now() + 30_000 && old.refresh_token) {
    try {
      const next = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: old.refresh_token } });
      storeSession(next);
      return next;
    } catch { storeSession(null); return null; }
  }
  try { await request('/auth/v1/user', { session: old }); return old; }
  catch { storeSession(null); return null; }
}
export async function getProfile(session) {
  // Always fetch the signed-in user's own profile by auth user ID.
  // Without this filter, an admin (who can read all profiles) could receive another player's row.
  if (!session?.access_token) return null;
  const user = await request('/auth/v1/user', { session });
  if (!user?.id) return null;
  const rows = await request(`/rest/v1/profiles?select=id,email,username,role,created_at&id=eq.${encodeURIComponent(user.id)}&limit=1`, { session });
  return rows?.[0] || null;
}
export async function rpc(session, functionName, params = {}) {
  return request(`/rest/v1/rpc/${encodeURIComponent(functionName)}`, { session, method: 'POST', body: params });
}
export async function tableRequest(session, table, query = 'select=*', options = {}) {
  const { method = 'GET', body, prefer } = options;
  return request(`/rest/v1/${table}?${query}`, {
    session, method, body,
    headers: { ...(prefer ? { Prefer: prefer } : {}) },
  });
}
export async function uploadGameArt(session, objectPath, file) {
  const safePath = objectPath.split('/').map(encodeURIComponent).join('/');
  await request(`/storage/v1/object/game-art/${safePath}`, {
    session, method: 'POST', body: file, raw: true,
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
  });
  return `${baseUrl()}/storage/v1/object/public/game-art/${safePath}`;
}
export { isBackendConfigured };
export async function fetchPublicConfig() {
  if (!isBackendConfigured()) return { characters: [], enemies: [], settings: [] };
  const [characters, enemies, settings] = await Promise.all([
    request('/rest/v1/game_characters?select=*'),
    request('/rest/v1/game_enemies?select=*'),
    request('/rest/v1/game_settings?select=key,value'),
  ]);
  return { characters: characters || [], enemies: enemies || [], settings: settings || [] };
}
