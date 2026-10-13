import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioDramaPlayer, spokenTextParts } from '../components/AudioDramaPlayer.jsx';
import { narrationSpeakerForRole, parseStoryScript, playDrama } from '../lib/audioDrama.js';

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const originalAudio = globalThis.Audio;

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

  it('requires the ElevenLabs Cloudinary-saved audio and does not fall back to browser speech', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      if (url === '/api/auth/csrf') return { ok: true, json: async () => ({ csrfToken: 'test-token' }) };
      if (url === '/api/speech/audio-drama') {
        return {
          ok: false,
          json: async () => ({ error: { message: { en: 'ElevenLabs and Cloudinary are not configured.' } } }),
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const browserSpeak = vi.fn();
    globalThis.window = { speechSynthesis: { speak: browserSpeak } };
    const onError = vi.fn();
    const player = playDrama(
      parseStoryScript('[Storyteller]: শুরু।'),
      vi.fn(),
      vi.fn(),
      { lang: 'bn', onError },
    );

    player.play();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speech/audio-drama', expect.any(Object));
    expect(globalThis.fetch.mock.calls.some(([url]) => /google-tts|audio-drama\/free|elevenlabs-tts/.test(url))).toBe(false);
    expect(browserSpeak).not.toHaveBeenCalled();
    player.close();
  });

  it('plays audio drama segments saved to Cloudinary without calling per-line TTS', async () => {
    const savedSegments = [
      { speaker: 'storyteller', text: 'গল্প শুরু।', url: 'https://media.example/story-segment.mp3' },
      { speaker: 'father', text: 'চলুন শুরু করি।', url: 'https://media.example/father-segment.mp3' },
    ];
    globalThis.fetch = vi.fn(async (url) => {
      if (url === '/api/auth/csrf') {
        return { ok: true, json: async () => ({ csrfToken: 'test-token' }) };
      }
      if (url === '/api/speech/audio-drama') {
        return {
          ok: true,
          json: async () => ({
            audioUrl: 'https://media.example/full-story.mp3',
            segments: savedSegments,
            cached: false,
          }),
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const createMediaElementSource = vi.fn();
    globalThis.window = {
      AudioContext: class {
        resume() { return Promise.resolve(); }
        createMediaElementSource(...args) { return createMediaElementSource(...args); }
      },
    };
    const audioInstances = [];
    globalThis.Audio = class {
      constructor(src) {
        this.src = src;
        audioInstances.push(this);
      }

      play() {
        this.onplaying?.();
        return Promise.resolve();
      }

      pause() {}

      removeAttribute() {}

      load() {}
    };

    const progress = vi.fn();
    const onNotice = vi.fn();
    const player = playDrama(
      parseStoryScript('[Storyteller]: গল্প শুরু।\n[Father]: চলুন শুরু করি।'),
      progress,
      vi.fn(),
      { lang: 'bn', onNotice, spatial: true },
    );

    player.play();
    await vi.waitFor(() => expect(audioInstances).toHaveLength(1));
    expect(audioInstances[0].src).toBe(savedSegments[0].url);
    audioInstances[0].onended();
    await vi.waitFor(() => expect(audioInstances).toHaveLength(2));

    expect(audioInstances[1].src).toBe(savedSegments[1].url);
    expect(progress.mock.calls.some(([event]) => event.source === 'cloudinary')).toBe(true);
    expect(createMediaElementSource).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speech/audio-drama', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ content: '[Storyteller]: গল্প শুরু।\n[Father]: চলুন শুরু করি।' }),
    }));
    expect(globalThis.fetch.mock.calls.some(([url]) => /google-tts|audio-drama\/free|elevenlabs-tts/.test(url))).toBe(false);
    expect(onNotice).toHaveBeenCalledWith('ElevenLabs-এর অডিও Cloudinary-তে সংরক্ষণ করা হয়েছে।');
    player.close();
  });
});
