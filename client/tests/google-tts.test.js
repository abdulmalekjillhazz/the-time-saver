import { afterEach, describe, expect, it, vi } from 'vitest';
import { speakWithGoogleTts } from '../lib/voiceBriefing.js';

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  vi.unstubAllGlobals();
});

describe('free Google Translate voice briefing playback', () => {
  it('sends Bengali text with CSRF protection and supports audio controls', async () => {
    class FakeAudio {
      static instances = [];

      constructor(source) {
        this.src = source;
        this.play = vi.fn(() => Promise.resolve());
        this.pause = vi.fn();
        this.load = vi.fn();
        this.removeAttribute = vi.fn();
        FakeAudio.instances.push(this);
      }
    }
    const createObjectURL = vi.fn(() => 'blob:google-tts');
    const revokeObjectURL = vi.fn();
    globalThis.window = {
      Audio: FakeAudio,
      URL: { createObjectURL, revokeObjectURL },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'csrf-test-token' }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['audio']) });
    vi.stubGlobal('fetch', fetchMock);
    const onEnd = vi.fn();
    const onError = vi.fn();

    const controller = speakWithGoogleTts('শুভ সকাল!', { lang: 'bn', locale: 'bn', onEnd, onError });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    const [audio] = FakeAudio.instances;
    const request = fetchMock.mock.calls[1];

    expect(request[0]).toBe('/api/speech/briefing');
    expect(request[1].headers['X-CSRF-Token']).toBe('csrf-test-token');
    expect(JSON.parse(request[1].body)).toEqual({ text: 'শুভ সকাল!', lang: 'bn' });
    expect(audio.play).toHaveBeenCalledOnce();

    controller.pause();
    expect(audio.pause).toHaveBeenCalledOnce();
    controller.resume();
    expect(audio.play).toHaveBeenCalledTimes(2);
    audio.onended();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:google-tts');
  });

  it('surfaces provider errors instead of silently falling back to another voice', async () => {
    globalThis.window = {
      Audio: class {},
      URL: { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() },
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'csrf-test-token' }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: { en: 'Google voice is temporarily unavailable.', bn: 'Google voice সাময়িকভাবে চালানো যাচ্ছে না।' } } }),
      }));
    const onError = vi.fn();

    speakWithGoogleTts('শুভ সকাল!', { lang: 'bn', locale: 'bn', onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onError.mock.calls[0][0].message).toBe('Google voice সাময়িকভাবে চালানো যাচ্ছে না।');
  });
});
