import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

// These tests run without a database. They prove the guards work before any data is touched.
const config = {
  NODE_ENV: 'test',
  PORT: 0,
  MONGODB_URI: 'mongodb://127.0.0.1:1/unused',
  CLIENT_ORIGIN: 'http://localhost:3000',
};
const app = createApp({ config });

describe('app guards (no database needed)', () => {
  it('health check responds', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('a state-changing request without a CSRF token is refused', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('Google voice synthesis requires CSRF before any provider request', async () => {
    const res = await request(app)
      .post('/api/speech/briefing')
      .send({ text: 'শুভ সকাল!', lang: 'bn' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('free story voice synthesis requires CSRF before any provider request', async () => {
    const res = await request(app)
      .post('/api/speech/audio-drama/free')
      .send({ content: 'The story begins.', lang: 'en' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('Cloudinary story audio generation requires CSRF before any provider request', async () => {
    const res = await request(app)
      .post('/api/speech/audio-drama')
      .send({ content: '[Storyteller]: The story begins.' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('the batch word-meaning endpoint requires a CSRF token', async () => {
    const res = await request(app)
      .post('/api/word-meanings')
      .send({ words: ['story'], lang: 'bn' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('the batch word-meaning endpoint validates its payload before database access', async () => {
    const token = 'dddddddddddddddddddddddddddddddddddddddddddd';
    const res = await request(app)
      .post('/api/word-meanings')
      .set('Cookie', `sr_csrf=${token}`)
      .set('X-CSRF-Token', token)
      .send({ words: 'not-an-array', lang: 'bn' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('the batch word-meaning endpoint requires a database before contacting translation providers', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Translation providers should not be contacted without a database.');
    };
    const token = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    try {
      const res = await request(app)
        .post('/api/word-meanings')
        .set('Cookie', `sr_csrf=${token}`)
        .set('X-CSRF-Token', token)
        .send({ words: ['story', 'story'], lang: 'bn' });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('UNAVAILABLE');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('a CSRF header that does not match the cookie is refused', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', 'sr_csrf=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      .set('X-CSRF-Token', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('a foreign Origin is refused even with a valid token pair', async () => {
    const token = 'cccccccccccccccccccccccccccccccccccccccccccc';
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Cookie', `sr_csrf=${token}`)
      .set('X-CSRF-Token', token)
      .send({});
    expect(res.status).toBe(403);
  });

  it('data routes return 503 when the database is not connected', async () => {
    const res = await request(app).get('/api/routines');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UNAVAILABLE');
  });

  it('unknown paths return a JSON 404 envelope', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
