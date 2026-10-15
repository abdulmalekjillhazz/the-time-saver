import { afterEach, describe, expect, it, vi } from 'vitest';
import { speakWithGoogleTts } from '../lib/voiceBriefing.js';

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  vi.unstubAllGlobals();
});

describe('free Google Translate voice briefing playback', () => {
  class FakeAudioContext {
    static instances = [];

    constructor() {
      this.currentTime = 0;
      this.destination = {};
      this.state = 'running';
      this.sources = [];
      this.resume = vi.fn(async () => {});
      this.decodeAudioData = vi.fn(async () => ({ duration: 60 }));
      this.close = vi.fn(async () => { this.state = 'closed'; });
      FakeAudioContext.instances.push(this);
    }

    createBufferSource() {
      const source = {
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(() => source.onended?.()),
      };
      this.sources.push(source);
      return source;
    }
  }

  function stubAudioApi(fetchMock) {
    globalThis.window = { AudioContext: FakeAudioContext };
    vi.stubGlobal('fetch', fetchMock);
  }

  it('unlocks audio on the user gesture, sends Bengali text with CSRF protection, and supports audio controls', async () => {
    FakeAudioContext.instances = [];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'csrf-test-token' }) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    stubAudioApi(fetchMock);
    const onEnd = vi.fn();
    const onError = vi.fn();

    const controller = speakWithGoogleTts('শুভ সকাল!', { lang: 'bn', locale: 'bn', onEnd, onError });
    const [context] = FakeAudioContext.instances;
    expect(context.resume).toHaveBeenCalledOnce();

    await vi.waitFor(() => expect(context.sources).toHaveLength(1));
    const request = fetchMock.mock.calls[1];
    expect(request[0]).toBe('/api/speech/briefing');
    expect(request[1].headers['X-CSRF-Token']).toBe('csrf-test-token');
    expect(JSON.parse(request[1].body)).toEqual({ text: 'শুভ সকাল!', lang: 'bn' });
    expect(context.sources[0].start).toHaveBeenCalledWith(0, 0);

    context.currentTime = 4;
    controller.pause();
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
    controller.resume();
    await vi.waitFor(() => expect(context.sources).toHaveLength(2));
    expect(context.sources[1].start).toHaveBeenCalledWith(0, 4);

    context.sources[1].onended();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('surfaces provider errors instead of silently falling back to another voice', async () => {
    FakeAudioContext.instances = [];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'csrf-test-token' }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: { en: 'Google voice is temporarily unavailable.', bn: 'Google voice সাময়িকভাবে চালানো যাচ্ছে না।' } } }),
      });
    stubAudioApi(fetchMock);
    const onError = vi.fn();

    speakWithGoogleTts('শুভ সকাল!', { lang: 'bn', locale: 'bn', onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onError.mock.calls[0][0].message).toBe('Google voice সাময়িকভাবে চালানো যাচ্ছে না।');
  });
});
