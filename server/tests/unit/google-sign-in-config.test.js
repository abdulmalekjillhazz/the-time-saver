import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authRouter } from '../../src/routes/auth.js';

describe('Google sign-in configuration endpoint', () => {
  it('exposes the configured public OAuth client ID to the sign-in page', async () => {
    const app = express();
    app.use('/api/auth', authRouter({ GOOGLE_CLIENT_ID: 'public-client-id.apps.googleusercontent.com' }));

    const response = await request(app).get('/api/auth/google/config');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ clientId: 'public-client-id.apps.googleusercontent.com' });
  });

  it('reports Google sign-in as unavailable without exposing configuration details', async () => {
    const app = express();
    app.use('/api/auth', authRouter({}));

    const response = await request(app).get('/api/auth/google/config');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ clientId: null });
  });
});
