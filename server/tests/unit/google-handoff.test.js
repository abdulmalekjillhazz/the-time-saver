import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const verifyIdToken = vi.fn();
const mockHandoffCreate = vi.fn();
const mockFindOneAndDelete = vi.fn();
const mockLoginGoogleUser = vi.fn();
const mockCreateSession = vi.fn();
const mockLoadUserForSession = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken(...args) {
      return verifyIdToken(...args);
    }
  },
}));
vi.mock('../../src/models/AuthHandoff.js', () => ({
  AuthHandoff: {
    create: (...args) => mockHandoffCreate(...args),
    findOneAndDelete: (...args) => mockFindOneAndDelete(...args),
  },
}));
vi.mock('../../src/services/account.js', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  loginGoogleUser: (...args) => mockLoginGoogleUser(...args),
}));
vi.mock('../../src/middleware/rateLimit.js', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));
vi.mock('../../src/services/session.js', () => ({
  createSession: (...args) => mockCreateSession(...args),
  loadSession: vi.fn(),
  loadUserForSession: (...args) => mockLoadUserForSession(...args),
  rotateSession: vi.fn(),
  revokeSessionByToken: vi.fn(),
}));

const { authRouter } = await import('../../src/routes/auth.js');

describe('Google sign-in handoff', () => {
  const user = {
    _id: 'user-id',
    email: 'person@example.com',
    displayName: 'Person',
    locale: 'bn',
    timezone: 'Asia/Dhaka',
  };
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter({ GOOGLE_CLIENT_ID: 'web-client-id' }));
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: { code: err.code || 'INTERNAL' } });
    });
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-id',
        email: user.email,
        email_verified: true,
        name: user.displayName,
      }),
    });
    mockLoginGoogleUser.mockResolvedValue(user);
    mockHandoffCreate.mockResolvedValue({});
    mockCreateSession.mockResolvedValue({ token: 'session-token', csrf: 'csrf-token' });
    mockLoadUserForSession.mockResolvedValue(user);
  });

  it('issues a hashed short-lived one-time code and exchanges it for an app session', async () => {
    const issue = await request(app)
      .post('/api/auth/google/handoff')
      .send({ credential: 'g'.repeat(120), locale: 'en', timezone: 'UTC' });

    expect(issue.status).toBe(200);
    expect(issue.body.code).toMatch(/^[A-Za-z0-9_-]{40,50}$/);
    expect(issue.body.sessionToken).toBeUndefined();
    expect(issue.headers['cache-control']).toBe('no-store');
    expect(mockHandoffCreate).toHaveBeenCalledOnce();
    const savedHandoff = mockHandoffCreate.mock.calls[0][0];
    expect(savedHandoff.tokenHash).not.toBe(issue.body.code);
    expect(savedHandoff.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(savedHandoff.userId).toBe(user._id);
    expect(savedHandoff.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(savedHandoff.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 2 * 60 * 1000);

    const lean = vi.fn().mockResolvedValue({ userId: user._id });
    mockFindOneAndDelete.mockReturnValue({ lean });
    const exchange = await request(app)
      .post('/api/auth/google/handoff/exchange')
      .send({ code: issue.body.code });

    expect(exchange.status).toBe(200);
    expect(exchange.body.sessionToken).toBe('session-token');
    expect(exchange.body.user.id).toBe(user._id);
    expect(exchange.headers['cache-control']).toBe('no-store');
    expect(mockFindOneAndDelete).toHaveBeenCalledOnce();
    expect(mockFindOneAndDelete.mock.calls[0][0].tokenHash).toBe(savedHandoff.tokenHash);
    expect(mockCreateSession).toHaveBeenCalledWith(user._id);
  });

  it('rejects a handoff code that has already expired or been consumed', async () => {
    const lean = vi.fn().mockResolvedValue(null);
    mockFindOneAndDelete.mockReturnValue({ lean });

    const response = await request(app)
      .post('/api/auth/google/handoff/exchange')
      .send({ code: 'x'.repeat(43) });

    expect(response.status).toBe(401);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});
