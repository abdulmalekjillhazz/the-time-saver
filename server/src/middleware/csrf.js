import { AppError, MSG } from '../lib/AppError.js';
import { CSRF_COOKIE, CSRF_HEADER } from '../lib/cookies.js';
import { safeEqual } from '../lib/crypto.js';

export function csrfProtection(config) {
  const allowedOrigin = String(config?.CLIENT_ORIGIN || '').replace(/\/+$/, '');
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const origin = String(req.get('origin') || '').replace(/\/+$/, '');
    const isAllowed =
      !origin ||
      origin === allowedOrigin ||
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('https://localhost') ||
      origin.startsWith('capacitor://localhost') ||
      origin.startsWith('ionic://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin.startsWith('http://10.0.2.2');
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
