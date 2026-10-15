import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGoogleTtsRequest,
  generateGoogleTtsAudio,
  GoogleTtsApiError,
  splitGoogleTtsText,
} from '../../src/services/googleTts.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('free Google Translate text-to-speech', () => {
  it('builds a keyless Bengali audio request', () => {
    const request = buildGoogleTtsRequest({ text: 'শুভ সকাল!', lang: 'bn' });
    const url = new URL(request.url);

    expect(url.origin + url.pathname).toBe('https://translate.google.com/translate_tts');
    expect(url.searchParams.get('client')).toBe('tw-ob');
    expect(url.searchParams.get('tl')).toBe('bn');
    expect(url.searchParams.get('q')).toBe('শুভ সকাল!');
    expect(url.searchParams.has('key')).toBe(false);
    expect(request.headers.Accept).toBe('audio/mpeg');
  });

  it('splits long Bengali text at natural boundaries without losing content', () => {
    const text = `${'বাংলা রুটিন। '.repeat(24)}শেষ বাক্য!`;
    const chunks = splitGoogleTtsText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => [...chunk].length <= 180)).toBe(true);
    expect(chunks.join(' ')).toContain('শেষ বাক্য!');
  });

  it('requests and joins MP3 chunks for a long briefing', async () => {
    const providerFetch = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: async () => Uint8Array.from([0xff, 0xfb, 0x90, 0x64]).buffer,
    }));
    vi.stubGlobal('fetch', providerFetch);
    const text = 'বাংলা রুটিন। '.repeat(20);

    const audio = await generateGoogleTtsAudio({ text, lang: 'bn' });

    expect(providerFetch.mock.calls.length).toBeGreaterThan(1);
    expect(audio.length).toBe(providerFetch.mock.calls.length * 4);
    expect(providerFetch.mock.calls[0][0]).toContain('tl=bn');
    expect(providerFetch.mock.calls[0][1].method).toBe('GET');
  });

  it('generates English voice audio without a paid API key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: async () => Uint8Array.from([0xff, 0xfb, 0x90, 0x64]).buffer,
    })));

    const audio = await generateGoogleTtsAudio({ text: 'Good morning!', lang: 'en' });
    expect(audio).toEqual(Buffer.from([0xff, 0xfb, 0x90, 0x64]));
  });

  it('reports upstream failures and refuses non-audio responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: { get: () => 'text/html' },
      arrayBuffer: async () => Buffer.from('blocked').buffer,
    })));

    await expect(generateGoogleTtsAudio({ text: 'Hello.', lang: 'en' }))
      .rejects.toMatchObject({ status: 429, upstreamCode: 'upstream_unavailable' });

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    })));
    const error = await generateGoogleTtsAudio({ text: 'Hello.', lang: 'en' }).catch((caught) => caught);
    expect(error).toBeInstanceOf(GoogleTtsApiError);
    expect(error.upstreamCode).toBe('invalid_audio_response');
  });

  it('rejects empty text, oversized chunks, and unsupported languages', () => {
    expect(() => buildGoogleTtsRequest({ text: 'x'.repeat(181), lang: 'en' }))
      .toThrow('1 to 180 characters');
    expect(() => buildGoogleTtsRequest({ text: 'Hello.', lang: 'fr' }))
      .toThrow('supported Google TTS language');
    expect(splitGoogleTtsText('   ')).toEqual([]);
  });
});
