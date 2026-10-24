import { afterEach, describe, expect, it, vi } from 'vitest';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { csrfProtection } from '../../src/middleware/csrf.js';
import { speechRouter } from '../../src/routes/speech.js';

vi.mock('../../src/middleware/requireAuth.js', () => ({
  requireAuth: (_req, _res, next) => next(),
}));

vi.mock('../../src/middleware/rateLimit.js', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));

const csrfToken = 'a'.repeat(48);
const config = {
  CLIENT_ORIGIN: 'https://example.com',
  ELEVENLABS_API_KEY: 'configured-but-must-not-be-used',
};

function createSpeechApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection(config));
  app.use('/api/speech', speechRouter({ config }));
  return app;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('free speech routes never call ElevenLabs', () => {
  it.each([
    ['/pronounce', { text: 'Hello there.', lang: 'en' }],
    ['/briefing', { text: 'Good morning.', lang: 'en' }],
    ['/audio-drama/free', { content: '[Storyteller]: The story begins.', lang: 'en' }],
  ])('%s uses Google TTS even when an ElevenLabs key is configured', async (path, body) => {
    const providerRequest = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    }));
    vi.stubGlobal('fetch', providerRequest);

    const response = await request(createSpeechApp())
      .post(`/api/speech${path}`)
      .set('Cookie', `sr_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send(body);

    expect(response.status).toBe(200);
    expect(response.headers['x-audio-source']).toBe('google-tts');
    expect(providerRequest).toHaveBeenCalledOnce();
    expect(providerRequest.mock.calls[0][0]).toMatch(/^https:\/\/translate\.google\.com\//);
  });
});
