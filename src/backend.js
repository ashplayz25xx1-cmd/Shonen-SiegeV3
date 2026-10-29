import { SUPABASE_URL, SUPABASE_ANON_KEY, isBackendConfigured } from './backend-config.js';

const SESSION_KEY = 'shonen-siege-supabase-session-v1';
const AUTH_CALLBACK_KEY = 'shonen-siege-auth-callback-type-v1';
const baseUrl = () => SUPABASE_URL.replace(/\/$/, '');
export function authRedirectUrl() {
  if (typeof window === 'undefined') return 'https://ashplayz25xx1-cmd.github.io/Shonen-SiegeV3/';
  // Do not send real players to localhost if they happen to open a development build.
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return 'https://ashplayz25xx1-cmd.github.io/Shonen-SiegeV3/';
  return `${window.location.origin}${window.location.pathname}`;
}
export function getPendingAuthCallbackType() {
  try { return localStorage.getItem(AUTH_CALLBACK_KEY) || ''; } catch { return ''; }
}
export function clearPendingAuthCallbackType() {
  try { localStorage.removeItem(AUTH_CALLBACK_KEY); } catch {}
}
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
  if (!session) { localStorage.removeItem(SESSION_KEY); return null; }
  const expiresIn = Number(session.expires_in || 3600);
  const normalized = { ...session, expires_at: Number(session.expires_at || (Math.floor(Date.now() / 1000) + expiresIn)) };
  localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
  return normalized;
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
  const path = `/auth/v1/signup?redirect_to=${encodeURIComponent(authRedirectUrl())}`;
  const data = await request(path, { method: 'POST', body: { email, password, data: { username } } });
  if (data?.access_token) return storeSession(data);
  return data;
}
export async function signIn(email, password) {
  const data = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  return storeSession(data) || data;
}
export async function requestPasswordReset(email) {
  await request(`/auth/v1/recover?redirect_to=${encodeURIComponent(authRedirectUrl())}`, { method: 'POST', body: { email } });
}
export async function updatePassword(session, password) {
  const data = await request('/auth/v1/user', { session, method: 'PUT', body: { password } });
  return data;
}
export async function resendSignupConfirmation(email) {
  await request(`/auth/v1/resend?redirect_to=${encodeURIComponent(authRedirectUrl())}`, { method: 'POST', body: { type: 'signup', email } });
}
export async function requestEmailCode(email) {
  // create_user:false ensures the passwordless form cannot silently create accounts.
  await request(`/auth/v1/otp?redirect_to=${encodeURIComponent(authRedirectUrl())}`, { method: 'POST', body: { email, create_user: false } });
}
export async function verifyEmailCode(email, token) {
  const data = await request('/auth/v1/verify', { method: 'POST', body: { email, token: String(token).trim(), type: 'email' } });
  if (data?.access_token) return storeSession(data);
  return data;
}
export function signInWithGoogle() {
  if (typeof window === 'undefined') throw new Error('Google sign-in is only available in a browser.');
  const params = new URLSearchParams({ provider: 'google', redirect_to: authRedirectUrl(), apikey: SUPABASE_ANON_KEY });
  window.location.assign(`${baseUrl()}/auth/v1/authorize?${params.toString()}`);
}
export async function getCurrentAuthUser(session) {
  if (!session?.access_token) return null;
  return request('/auth/v1/user', { session });
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
  const callbackType = hash.get('type') || url.searchParams.get('type') || '';
  if (callbackType) { try { localStorage.setItem(AUTH_CALLBACK_KEY, callbackType); } catch {} }
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
      return storeSession(next) || next;
    } catch { storeSession(null); return null; }
  }
  try { await request('/auth/v1/user', { session: old }); return old; }
  catch { storeSession(null); return null; }
}
export async function getProfile(session) {
  // Always fetch the signed-in user's own profile by auth user ID.
  if (!session?.access_token) return null;
  const user = await request('/auth/v1/user', { session });
  if (!user?.id) return null;
  const rows = await request(`/rest/v1/profiles?select=id,email,username,role,created_at&id=eq.${encodeURIComponent(user.id)}&limit=1`, { session });
  if (!rows?.[0]) return null;
  return { ...rows[0], auth_email_confirmed_at: user.email_confirmed_at || null, auth_created_at: user.created_at || null, auth_provider: user.app_metadata?.provider || 'email' };
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
