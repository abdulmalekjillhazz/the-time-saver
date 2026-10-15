// Minimal CSRF-aware request helper, usable outside PrivateApp.jsx.
export async function apiRequest(path, { method = 'GET', body, locale = 'en' } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    const csrfBody = await csrfResponse.json().catch(() => ({}));
    if (!csrfResponse.ok || typeof csrfBody.csrfToken !== 'string') {
      throw new Error('Could not establish a security token for this request.');
    }
    headers['X-CSRF-Token'] = csrfBody.csrfToken;
  }
  const res = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message;
    throw new Error(typeof message === 'string' ? message : message?.[locale] || message?.en || 'Request failed');
  }
  return data;
}

export async function apiRequestAudio(path, { body, locale = 'en', signal } = {}) {
  const csrfResponse = await fetch('/api/auth/csrf', {
    credentials: 'same-origin',
    signal,
  });
  const csrfBody = await csrfResponse.json().catch(() => ({}));
  if (!csrfResponse.ok || typeof csrfBody.csrfToken !== 'string') {
    throw new Error('Could not establish a security token for this request.');
  }

  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfBody.csrfToken,
    },
    credentials: 'same-origin',
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
