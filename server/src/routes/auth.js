import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  googleHandoffExchangeSchema,
} from '@smart-routine/shared';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { extractSessionToken } from '../middleware/requireAuth.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { AppError, MSG } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { setCsrfCookie, setSessionCookies, clearSessionCookies } from '../lib/cookies.js';
import { registerUser, loginUser, loginGoogleUser } from '../services/account.js';
import { AuthHandoff } from '../models/AuthHandoff.js';
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
const HANDOFF_TTL_MS = 2 * MINUTE;

export function parseGoogleClientIds(config = {}) {
  const rawList = [
    ...(typeof config.GOOGLE_CLIENT_ID === 'string' ? config.GOOGLE_CLIENT_ID.split(/[,\s]+/) : []),
    ...(typeof config.GOOGLE_ANDROID_CLIENT_ID === 'string' ? config.GOOGLE_ANDROID_CLIENT_ID.split(/[,\s]+/) : []),
  ]
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(rawList)];
}

export function csrfRouter(config) {
  const r = Router();
  r.get('/', (_req, res) => {
    const csrfToken = randomToken(32);
    setCsrfCookie(res, config, csrfToken);
    res.set('Cache-Control', 'no-store');
    res.json({ csrfToken });
  });
  return r;
}

export function authRouter(config) {
  const r = Router();
  const googleClientIds = parseGoogleClientIds(config);
  const primaryWebClientId = googleClientIds[0] || null;
  const googleClient = primaryWebClientId ? new OAuth2Client(primaryWebClientId) : null;

  async function getGoogleUser(credential) {
    if (!googleClient || !googleClientIds.length) throw new AppError(503, 'UNAVAILABLE', MSG.unavailable);
    let claims;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientIds.length === 1 ? googleClientIds[0] : googleClientIds,
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
    return loginGoogleUser({
      email,
      googleId: claims.sub,
      displayName,
      avatarUrl: claims.picture,
    });
  }

  r.get('/google/config', (_req, res) => {
    res.json({ clientId: primaryWebClientId });
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
        res.status(201).json({ user: toPublicUser(user), csrfToken: csrf, sessionToken: token });
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
        res.json({ user: toPublicUser(user), csrfToken: csrf, sessionToken: token });
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
        const user = await getGoogleUser(req.body.credential);
        const { token, csrf } = await createSession(user._id);
        setSessionCookies(res, config, token, csrf);
        res.json({ user: toPublicUser(user), csrfToken: csrf, sessionToken: token });
      } catch (err) {
        next(err);
      }
    }
  );

  r.post(
    '/google/handoff',
    rateLimit({ name: 'google-handoff-create', limit: 10, windowMs: 15 * MINUTE }),
    validate({ body: googleLoginSchema }),
    async (req, res, next) => {
      try {
        const user = await getGoogleUser(req.body.credential);
        const code = randomToken(32);
        await AuthHandoff.create({
          tokenHash: sha256(code),
          userId: user._id,
          expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
        });
        res.set('Cache-Control', 'no-store');
        res.json({ code });
      } catch (err) {
        next(err);
      }
    }
  );

  r.post(
    '/google/handoff/exchange',
    rateLimit({ name: 'google-handoff-exchange', limit: 20, windowMs: 15 * MINUTE }),
    validate({ body: googleHandoffExchangeSchema }),
    async (req, res, next) => {
      try {
        const handoff = await AuthHandoff.findOneAndDelete({
          tokenHash: sha256(req.body.code),
          expiresAt: { $gt: new Date() },
        }).lean();
        if (!handoff) throw new AppError(401, 'UNAUTHENTICATED', MSG.loginFailed);

        const user = await loadUserForSession({ userId: handoff.userId });
        const { token, csrf } = await createSession(user._id);
        setSessionCookies(res, config, token, csrf);
        res.set('Cache-Control', 'no-store');
        res.json({ user: toPublicUser(user), csrfToken: csrf, sessionToken: token });
      } catch (err) {
        next(err);
      }
    }
  );

  r.post('/logout', async (req, res, next) => {
    try {
      await revokeSessionByToken(extractSessionToken(req));
      clearSessionCookies(res, config);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Rotates the session token. Presenting an old token later revokes the whole family.
  r.post('/refresh', rateLimit({ name: 'refresh', limit: 60, windowMs: MINUTE }), async (req, res, next) => {
    try {
      const session = await loadSession(extractSessionToken(req));
      const user = await loadUserForSession(session);
      const { token, csrf } = await rotateSession(session);
      setSessionCookies(res, config, token, csrf);
      res.json({ user: toPublicUser(user), csrfToken: csrf, sessionToken: token });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
