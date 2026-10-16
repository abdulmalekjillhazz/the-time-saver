import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioDramaPlayer, spokenTextParts } from '../components/AudioDramaPlayer.jsx';
import { narrationSpeakerForRole, parseStoryScript, playDrama } from '../lib/audioDrama.js';

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const originalAudio = globalThis.Audio;

class FakeAudio {
  static instances = [];

  constructor() {
    this.currentTime = 0;
    this.duration = 12;
    this.paused = true;
    this.volume = 1;
    this.play = vi.fn(async () => { this.paused = false; });
    this.pause = vi.fn(() => { this.paused = true; });
    this.load = vi.fn(() => this.onloadedmetadata?.());
    this.removeAttribute = vi.fn((name) => {
      if (name === 'src') this.src = '';
    });
    FakeAudio.instances.push(this);
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

describe('Cloudinary audio drama', () => {
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
    expect(markup).toContain('aria-label="Seek through the story"');
    expect(markup).toContain('Learn English by Story');
    expect(markup).not.toContain('Cloudinary');
    expect(markup).not.toContain('Google TTS');
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

  it('requests the saved Cloudinary asset, streams it, and supports pause and resume', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = FakeAudio;
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cached: true, audioUrl: 'https://res.cloudinary.com/test/audio.mp3' }),
      });

    const progress = vi.fn();
    const onEnd = vi.fn();
    const onNotice = vi.fn();
    const lines = parseStoryScript('[Storyteller]: The story begins.\n[Father]: Dad lost a shoe.');
    const player = playDrama(lines, progress, onEnd, { lang: 'bn', onNotice });

    player.play();
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    const [audio] = FakeAudio.instances;
    expect(audio.src).toBe('https://res.cloudinary.com/test/audio.mp3');
    expect(audio.preload).toBe('auto');
    expect(audio.play).toHaveBeenCalledOnce();

    const [csrfUrl] = globalThis.fetch.mock.calls[0];
    const [requestUrl, requestOptions] = globalThis.fetch.mock.calls[1];
    expect(csrfUrl).toBe('/api/auth/csrf');
    expect(requestUrl).toBe('/api/speech/audio-drama');
    expect(requestOptions.headers['X-CSRF-Token']).toBe('test-token');
    expect(JSON.parse(requestOptions.body)).toEqual({
      content: '[Storyteller]: The story begins.\n[Father]: Dad lost a shoe.',
    });
    expect(onNotice).toHaveBeenCalledWith('Cloudinary-তে সংরক্ষিত voice চালানো হচ্ছে।');

    audio.currentTime = 3;
    audio.ontimeupdate();
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({
      index: 0,
      fraction: 0.5,
      source: 'cloudinary',
    }));
    player.seek(1.5);
    expect(audio.currentTime).toBe(9);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({
      index: 1,
      fraction: 0.5,
    }));
    player.pause();
    expect(audio.pause).toHaveBeenCalledOnce();
    player.resume();
    expect(audio.play).toHaveBeenCalledTimes(2);

    audio.onended();
    expect(onEnd).toHaveBeenCalledOnce();
    player.close();
  });

  it('falls back to Google TTS when a saved Cloudinary audio file cannot be played', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = FakeAudio;
    vi.spyOn(globalThis.URL, 'createObjectURL').mockReturnValue('blob:google-fallback');
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    const onNotice = vi.fn();
    const progress = vi.fn();
    const player = playDrama(
      parseStoryScript('[Storyteller]: গল্প শুরু।\n[Father]: ঠিক আছে।'),
      progress,
      vi.fn(),
      {
        lang: 'bn',
        audioUrl: 'https://res.cloudinary.com/test/saved.mp3',
        storyContent: '[Storyteller]: গল্প শুরু।\n[Father]: ঠিক আছে।',
        onNotice,
      },
    );

    player.play();
    await vi.waitFor(() => expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce());
    FakeAudio.instances[0].onerror();
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(2));
    expect(FakeAudio.instances[1].src).toBe('blob:google-fallback');
    expect(FakeAudio.instances[1].play).toHaveBeenCalledOnce();
    FakeAudio.instances[1].currentTime = 3;
    FakeAudio.instances[1].ontimeupdate();
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'google' }));
    expect(globalThis.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/csrf',
      '/api/speech/audio-drama/free',
    ]);
    expect(JSON.parse(globalThis.fetch.mock.calls[1][1].body)).toEqual({
      content: 'গল্প শুরু। ঠিক আছে।',
      lang: 'bn',
    });
    expect(onNotice).toHaveBeenCalledWith('সংরক্ষিত গল্পের voice পাওয়া যায়নি—Google TTS চালানো হচ্ছে।');
    player.close();
  });

  it('uses Google TTS when multi-voice audio lookup fails', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = FakeAudio;
    vi.spyOn(globalThis.URL, 'createObjectURL').mockReturnValue('blob:google-fallback');
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: { en: 'ElevenLabs voice is unavailable.', bn: 'ElevenLabs voice পাওয়া যাচ্ছে না।' } } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    const onNotice = vi.fn();
    const player = playDrama(
      parseStoryScript('[Storyteller]: শুরু।'),
      vi.fn(),
      vi.fn(),
      { lang: 'bn', onNotice },
    );

    player.play();
    await vi.waitFor(() => expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce());
    expect(globalThis.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/csrf',
      '/api/speech/audio-drama',
      '/api/auth/csrf',
      '/api/speech/audio-drama/free',
    ]);
    expect(FakeAudio.instances[0].src).toBe('blob:google-fallback');
    expect(onNotice).toHaveBeenCalledWith('সংরক্ষিত গল্পের voice পাওয়া যায়নি—Google TTS চালানো হচ্ছে।');
    player.close();
  });

  it('plays an existing Cloudinary narration without requesting another generation', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = FakeAudio;
    globalThis.fetch = vi.fn();
    const onNotice = vi.fn();
    const player = playDrama(
      parseStoryScript('[Storyteller]: The story begins.'),
      vi.fn(),
      vi.fn(),
      { audioUrl: 'https://res.cloudinary.com/test/daily-lesson.mp3', onNotice },
    );

    player.play();
    await vi.waitFor(() => expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce());

    expect(FakeAudio.instances[0].src).toBe('https://res.cloudinary.com/test/daily-lesson.mp3');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith('Cloudinary-তে সংরক্ষিত voice চালানো হচ্ছে।');
    player.close();
  });
});
