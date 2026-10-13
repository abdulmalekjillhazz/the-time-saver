import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { registerSchema, loginSchema, googleLoginSchema } from '@smart-routine/shared';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { randomToken } from '../lib/crypto.js';
import { AppError, MSG } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { SESSION_COOKIE, setCsrfCookie, setSessionCookies, clearSessionCookies } from '../lib/cookies.js';
import { registerUser, loginUser, loginGoogleUser } from '../services/account.js';
import {
  createSession,
  loadSession,
  loadUserForSession,
  rotateSession,
  revokeSessionByToken,
} from '../services/session.js';
import { toPublicUser } from '../services/dto.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export function authRouter(config) {
  const r = Router();
  const googleClient = config.GOOGLE_CLIENT_ID ? new OAuth2Client(config.GOOGLE_CLIENT_ID) : null;

  // The browser calls this first to get a CSRF token for its state-changing requests.
  r.get('/csrf', (_req, res) => {
    const csrfToken = randomToken(32);
    setCsrfCookie(res, config, csrfToken);
    res.json({ csrfToken });
  });

  r.get('/google/config', (_req, res) => {
    res.json({ clientId: config.GOOGLE_CLIENT_ID || null });
  });

  r.post(
    '/register',
    validate({ body: registerSchema }),
    rateLimit({ name: 'register', limit: 60, windowMs: HOUR }),
    async (req, res, next) => {
      try {
        const user = await registerUser(req.body);
        const { token, csrf } = await createSession(user._id);
        setSessionCookies(res, config, token, csrf);
        res.status(201).json({ user: toPublicUser(user), csrfToken: csrf });
      } catch (err) {
        next(err);
      }
    }
  );

  r.post(
    '/login',
    rateLimit({ name: 'login-ip', limit: 20, windowMs: 15 * MINUTE }),
    validate({ body: loginSchema }),
    async (req, res, next) => {
      try {
        const user = await loginUser(req.body);
        const { token, csrf } = await createSession(user._id);
        setSessionCookies(res, config, token, csrf);
        res.json({ user: toPublicUser(user), csrfToken: csrf });
      } catch (err) {
        next(err);
      }
    }
  );

  r.post(
    '/google',
    rateLimit({ name: 'google-login', limit: 20, windowMs: 15 * MINUTE }),
    validate({ body: googleLoginSchema }),
    async (req, res, next) => {
      try {
        if (!googleClient) throw new AppError(503, 'UNAVAILABLE', MSG.unavailable);
        let claims;
        try {
          const ticket = await googleClient.verifyIdToken({
            idToken: req.body.credential,
            audience: config.GOOGLE_CLIENT_ID,
          });
          claims = ticket.getPayload();
        } catch (err) {
          logger.warn({ errName: err.name, code: err.code }, 'Google ID token verification failed');
          if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH'].includes(err.code)) {
            throw new AppError(503, 'UNAVAILABLE', MSG.unavailable);
          }
          throw new AppError(401, 'UNAUTHENTICATED', MSG.loginFailed);
        }
        if (!claims?.sub || !claims.email || claims.email_verified !== true) {
          throw new AppError(401, 'UNAUTHENTICATED', MSG.loginFailed);
        }

        const email = claims.email.toLowerCase();
        const displayName = String(claims.name || email.split('@')[0]).trim().slice(0, 60) || email;
        const user = await loginGoogleUser({
          email,
          googleId: claims.sub,
          displayName,
          avatarUrl: claims.picture,
        });
        const { token, csrf } = await createSession(user._id);
        setSessionCookies(res, config, token, csrf);
        res.json({ user: toPublicUser(user), csrfToken: csrf });
      } catch (err) {
        next(err);
      }
    }
  );

  r.post('/logout', async (req, res, next) => {
    try {
      await revokeSessionByToken(req.cookies?.[SESSION_COOKIE]);
      clearSessionCookies(res, config);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Rotates the session token. Presenting an old token later revokes the whole family.
  r.post('/refresh', rateLimit({ name: 'refresh', limit: 60, windowMs: MINUTE }), async (req, res, next) => {
    try {
      const session = await loadSession(req.cookies?.[SESSION_COOKIE]);
      const user = await loadUserForSession(session);
      const { token, csrf } = await rotateSession(session);
      setSessionCookies(res, config, token, csrf);
      res.json({ user: toPublicUser(user), csrfToken: csrf });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
