import { SESSION_COOKIE } from '../lib/cookies.js';
import { loadSession, loadUserForSession } from '../services/session.js';

export function extractSessionToken(req) {
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }
  const authHeader = req.get?.('authorization') || req.headers?.authorization || '';
  if (typeof authHeader === 'string' && /^Bearer\s+\S+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  const customHeader = req.get?.('x-session-token') || req.headers?.['x-session-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }
  return undefined;
}

// Sets req.user and req.userId from the session. Nothing from the request body is trusted for identity.
export async function requireAuth(req, _res, next) {
  try {
    const token = extractSessionToken(req);
    const session = await loadSession(token);
    const user = await loadUserForSession(session);
    req.session = session;
    req.user = user;
    req.userId = String(user._id);
    next();
  } catch (err) {
    next(err);
  }
}
