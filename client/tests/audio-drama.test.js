import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioDramaPlayer, spokenTextParts } from '../components/AudioDramaPlayer.jsx';
import { narrationSpeakerForRole, parseStoryScript, playDrama } from '../lib/audioDrama.js';

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const originalAudio = globalThis.Audio;

class FakeAudioContext {
  static instances = [];

  constructor() {
    this.currentTime = 0;
    this.destination = {};
    this.state = 'running';
    this.sources = [];
    this.resume = vi.fn(async () => {});
    this.decodeAudioData = vi.fn(async () => ({ duration: 12 }));
    this.close = vi.fn(async () => { this.state = 'closed'; });
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    return { gain: { value: 1 }, connect: vi.fn() };
  }

  createBufferSource() {
    const source = {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    this.sources.push(source);
    return source;
  }
}

afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalFetch === undefined) delete globalThis.fetch;
  else globalThis.fetch = originalFetch;
  if (originalAudio === undefined) delete globalThis.Audio;
  else globalThis.Audio = originalAudio;
});

describe('offline audio drama', () => {
  it('highlights spoken words progressively while preserving Bengali and English text', () => {
    const markup = renderToStaticMarkup(createElement(
      'p',
      null,
      spokenTextParts('one two তিন', 0.34, false),
    ));

    expect(markup.match(/bg-gold\/40/g)).toHaveLength(2);
    expect(markup).toContain('one');
    expect(markup).toContain('two');
    expect(markup).toContain('তিন');
  });

  it('renders the full story as dialogue bubbles with character icons', () => {
    const markup = renderToStaticMarkup(createElement(AudioDramaPlayer, {
      content: '[Storyteller]: The story starts.\n[Rahim - Father]: Let us begin.',
      lang: 'en',
    }));

    expect(markup).toContain('aria-label="Story dialogue"');
    expect(markup).toContain('🎙️');
    expect(markup).toContain('👨');
    expect(markup).toContain('The story starts.');
    expect(markup).toContain('Let us begin.');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('Learn English by Story');
    expect(markup).not.toContain('3D Audio Drama');
    expect(markup).not.toContain('3D Audio On');
  });

  it('parses speaker tags into mapped stereo and voice settings', () => {
    expect(parseStoryScript('[Storyteller]: Let us begin.\n[Father]: Let us begin.\n[Asha] Hello there.')).toEqual([
      { character: 'Storyteller', role: 'storyteller', text: 'Let us begin.', pan: 0, pitch: 1, rate: 1 },
      { character: 'Father', role: 'male', text: 'Let us begin.', pan: -0.45, pitch: 0.85, rate: 0.95 },
      { character: 'Asha', role: 'female', text: 'Hello there.', pan: 0.45, pitch: 1.15, rate: 1 },
    ]);
    expect(parseStoryScript('[Child]: I am ready.')[1]).toMatchObject({ role: 'child', pan: 0.2, pitch: 1.35, rate: 1.05 });
    expect(parseStoryScript('[রহিম]: বাম পাশ।\n[আশা]: ডান পাশ।')
      .filter(({ role }) => role !== 'storyteller')
      .map(({ role }) => role)).toEqual(['male', 'female']);
    expect(parseStoryScript('[Rahim - Father]: বাবা।\n[Asha - Mother]: মা।\n[Rafi - Child]: ছেলে।')
      .filter(({ role }) => role !== 'storyteller')
      .map(({ role }) => role)).toEqual(['male', 'female', 'child']);
    expect(parseStoryScript('[Mina - Adult Female]: Hello.\n[Tariq - Adult Male]: Hi.')
      .filter(({ role }) => role !== 'storyteller')
      .map(({ character, role }) => ({ character, role }))).toEqual([
      { character: 'Mina - Adult Female', role: 'female' },
      { character: 'Tariq - Adult Male', role: 'male' },
    ]);
  });

  it('adds storyteller framing in Bengali for older stories that lack narrator lines', () => {
    const lines = parseStoryScript('[Father]: চলুন শুরু করি।\n[Mother]: ঠিক আছে।');
    expect(lines.map(({ role }) => role)).toEqual(['storyteller', 'male', 'storyteller', 'female', 'storyteller']);
    expect(lines[0].text).toBe('গল্পটি শুরু হচ্ছে।');
    expect(lines.at(-1).text).toBe('এই ছিল আজকের গল্প।');
  });

  it('maps each speaker role to its configured ElevenLabs persona', () => {
    expect(['male', 'father'].map(narrationSpeakerForRole)).toEqual(['father', 'father']);
    expect(['female', 'mother'].map(narrationSpeakerForRole)).toEqual(['mother', 'mother']);
    expect(['child', 'son'].map(narrationSpeakerForRole)).toEqual(['son', 'son']);
    expect(narrationSpeakerForRole('storyteller')).toBe('storyteller');
  });

  it('uses free Google audio for stories, unlocks playback immediately, and supports pause and resume', async () => {
    FakeAudioContext.instances = [];
    globalThis.window = { AudioContext: FakeAudioContext };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });

    const onEnd = vi.fn();
    const onNotice = vi.fn();
    const lines = parseStoryScript('[Storyteller]: The story begins.\n[Father]: Dad lost a shoe.');
    const player = playDrama(lines, vi.fn(), onEnd, { lang: 'bn', onNotice });

    player.play();
    const [context] = FakeAudioContext.instances;
    expect(context.resume).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(context.sources).toHaveLength(1));

    const [requestUrl, requestOptions] = globalThis.fetch.mock.calls[1];
    expect(requestUrl).toBe('/api/speech/audio-drama/free');
    expect(requestOptions.headers['X-CSRF-Token']).toBe('test-token');
    expect(JSON.parse(requestOptions.body)).toEqual({
      content: lines.map(({ text }) => text).join(' '),
      lang: 'en',
    });
    expect(context.sources[0].start).toHaveBeenCalledWith(0, 0);
    expect(onNotice).toHaveBeenCalledWith('বিনামূল্যের Google voice-এ গল্পটি পড়া হচ্ছে।');

    context.currentTime = 3;
    player.pause();
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
    player.resume();
    await vi.waitFor(() => expect(context.sources).toHaveLength(2));
    expect(context.sources[1].start).toHaveBeenCalledWith(0, 3);

    context.sources[1].onended();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    player.close();
  });

  it('reports free voice provider failures without breaking story text rendering', async () => {
    FakeAudioContext.instances = [];
    globalThis.window = { AudioContext: FakeAudioContext };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: { en: 'Google voice is temporarily unavailable.', bn: 'Google voice সাময়িকভাবে চালানো যাচ্ছে না।' } } }),
      });
    const onError = vi.fn();
    const player = playDrama(
      parseStoryScript('[Storyteller]: শুরু।'),
      vi.fn(),
      vi.fn(),
      { lang: 'bn', onError },
    );

    player.play();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speech/audio-drama/free', expect.any(Object));
    expect(onError.mock.calls[0][0]).toBe('Google voice সাময়িকভাবে চালানো যাচ্ছে না।');
    player.close();
  });
});
