const SESSION_TOKEN_STORAGE_KEY = 'sr-session-token-v1';

export function getStoredSessionToken() {
  try {
    const token = globalThis.window?.localStorage?.getItem(SESSION_TOKEN_STORAGE_KEY);
    return typeof token === 'string' && token.trim() ? token.trim() : '';
  } catch {
    return '';
  }
}

export function setStoredSessionToken(token) {
  try {
    if (typeof token === 'string' && token.trim()) {
      globalThis.window?.localStorage?.setItem(SESSION_TOKEN_STORAGE_KEY, token.trim());
    }
  } catch {}
}

export function clearStoredSessionToken() {
  try {
    globalThis.window?.localStorage?.removeItem(SESSION_TOKEN_STORAGE_KEY);
  } catch {}
}

export function resolveApiUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return path;
  try {
    const win = globalThis.window;
    const isCapacitorNative = Boolean(win?.Capacitor?.isNativePlatform?.());
    const protocol = win?.location?.protocol || '';
    const hostname = win?.location?.hostname || '';
    if (
      isCapacitorNative &&
      (protocol === 'capacitor:' || protocol === 'file:' || hostname === 'localhost')
    ) {
      const base = (
        process.env.NEXT_PUBLIC_API_URL ||
        'https://made-your-dream-bigger.vercel.app'
      ).replace(/\/+$/, '');
      return `${base}${path}`;
    }
  } catch {}
  return path;
}

// Minimal CSRF-aware request helper, usable outside PrivateApp.jsx.
export async function apiRequest(path, { method = 'GET', body, locale = 'en', signal } = {}) {
  const headers = {};
  const sessionToken = getStoredSessionToken();
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const resolvedCsrfUrl = resolveApiUrl('/api/auth/csrf');
  const resolvedPath = resolveApiUrl(path);
  const credentialsMode = resolvedPath.startsWith('http') ? 'include' : 'same-origin';

  if (method !== 'GET' && method !== 'HEAD') {
    const csrfHeaders = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined;
    const csrfResponse = await fetch(resolvedCsrfUrl, {
      credentials: credentialsMode,
      cache: 'no-store',
      ...(csrfHeaders ? { headers: csrfHeaders } : {}),
      signal,
    });
    const csrfBody = await csrfResponse.json().catch(() => ({}));
    if (!csrfResponse.ok) throw new Error(`Security token request failed (HTTP ${csrfResponse.status}).`);
    if (typeof csrfBody.csrfToken !== 'string') throw new Error('The security token response was invalid.');
    headers['X-CSRF-Token'] = csrfBody.csrfToken;
  }
  const res = await fetch(resolvedPath, {
    method,
    headers,
    credentials: credentialsMode,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path === '/api/me') {
      clearStoredSessionToken();
    }
    const message = data?.error?.message;
    throw new Error(typeof message === 'string' ? message : message?.[locale] || message?.en || 'Request failed');
  }
  if (typeof data?.sessionToken === 'string' && data.sessionToken) {
    setStoredSessionToken(data.sessionToken);
  }
  if (path === '/api/auth/logout') {
    clearStoredSessionToken();
  }
  return data;
}

export async function apiRequestAudio(path, { body, locale = 'en', signal } = {}) {
  const sessionToken = getStoredSessionToken();
  const resolvedCsrfUrl = resolveApiUrl('/api/auth/csrf');
  const resolvedPath = resolveApiUrl(path);
  const credentialsMode = resolvedPath.startsWith('http') ? 'include' : 'same-origin';

  const csrfResponse = await fetch(resolvedCsrfUrl, {
    credentials: credentialsMode,
    cache: 'no-store',
    ...(sessionToken ? { headers: { Authorization: `Bearer ${sessionToken}` } } : {}),
    signal,
  });
  const csrfBody = await csrfResponse.json().catch(() => ({}));
  if (!csrfResponse.ok) throw new Error(`Security token request failed (HTTP ${csrfResponse.status}).`);
  if (typeof csrfBody.csrfToken !== 'string') throw new Error('The security token response was invalid.');

  const headers = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfBody.csrfToken,
  };
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

  const response = await fetch(resolvedPath, {
    method: 'POST',
    headers,
    credentials: credentialsMode,
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message;
    throw new Error(typeof message === 'string' ? message : message?.[locale] || message?.en || 'Request failed');
  }
  return response.arrayBuffer();
}
