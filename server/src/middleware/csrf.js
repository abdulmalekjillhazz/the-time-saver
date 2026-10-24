import { AppError, MSG } from '../lib/AppError.js';
import { CSRF_COOKIE, CSRF_HEADER } from '../lib/cookies.js';
import { safeEqual } from '../lib/crypto.js';

function isAllowedLocalOrigin(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.username || url.password || !['', '/'].includes(url.pathname) || url.search || url.hash) return false;

  const hostname = url.hostname.toLowerCase();
  if (url.protocol === 'http:') {
    return ['localhost', '127.0.0.1', '10.0.2.2'].includes(hostname);
  }
  if (url.protocol === 'https:') return hostname === 'localhost';
  return ['capacitor:', 'ionic:'].includes(url.protocol) && hostname === 'localhost';
}

export function csrfProtection(config) {
  const allowedOrigin = String(config?.CLIENT_ORIGIN || '').replace(/\/+$/, '');
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const origin = String(req.get('origin') || '').replace(/\/+$/, '');
    const isAllowed =
      !origin ||
      origin === allowedOrigin ||
      origin.endsWith('.vercel.app') ||
      isAllowedLocalOrigin(origin);
    if (!isAllowed) {
      return next(new AppError(403, 'CSRF_FAILED', MSG.csrf));
    }

    const cookie = req.cookies?.[CSRF_COOKIE];
    const header = req.get(CSRF_HEADER);
    if (cookie) {
      if (header && safeEqual(cookie, header)) return next();
      return next(new AppError(403, 'CSRF_FAILED', MSG.csrf));
    }
    // Allow same-origin / Vercel proxy / Capacitor APK requests that send a valid token header without a cookie.
    if (header && header.length >= 16) {
      return next();
    }
    return next(new AppError(403, 'CSRF_FAILED', MSG.csrf));
  };
}
