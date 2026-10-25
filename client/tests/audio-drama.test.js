import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseStoryNarration } from '@smart-routine/shared';
import { AudioDramaPlayer, spokenTextParts } from '../components/AudioDramaPlayer.jsx';
import {
  getStoryAudioProgressFromPosition,
  getStoryLineWeights,
  getStoryPositionFromAudioProgress,
  narrationSpeakerForRole,
  parseStoryScript,
  playDrama,
} from '../lib/audioDrama.js';
import { speakWithVoice } from '../lib/voiceBriefing.js';

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
    this.play = vi.fn(async () => {
      this.paused = false;
      this.onplaying?.();
    });
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Cloudinary audio drama', () => {
  it('highlights spoken words progressively while preserving Bengali and English text', () => {
    const markup = renderToStaticMarkup(createElement(
      'p',
      null,
      spokenTextParts('one two তিন', 0.34, false),
    ));

    expect(markup.match(/bg-gold\/40/g)).toHaveLength(1);
    expect(markup).toContain('one');
    expect(markup).toContain('two');
    expect(markup).toContain('তিন');
  });

  it('weights progress and seeking by spoken text length instead of giving every line equal time', () => {
    const lines = parseStoryScript(
      '[Storyteller]: Hi.\n[Father]: This is a much longer spoken sentence with several more words.',
    );
    const weights = getStoryLineWeights(lines);
    const audioPosition = getStoryPositionFromAudioProgress(0.5, weights);

    expect(weights[1]).toBeGreaterThan(weights[0] * 4);
    expect(audioPosition).toBeGreaterThan(1);
    expect(getStoryAudioProgressFromPosition(audioPosition, weights)).toBeCloseTo(0.5, 8);
  });

  it('offers a dedicated pronunciation action when a word meaning is open', () => {
    const markup = renderToStaticMarkup(createElement(
      'p',
      null,
      spokenTextParts(
        'Hello world',
        0,
        false,
        () => {},
        { keyId: 'line-0', term: 'Hello', meaning: 'হ্যালো' },
        'line',
        () => {},
      ),
    ));

    expect(markup).toContain('aria-label="Hear pronunciation: Hello"');
    expect(markup).toContain('Hear pronunciation');
  });

  it('shows story dialogue one chunk at a time with chunk navigation', () => {
    const markup = renderToStaticMarkup(createElement(AudioDramaPlayer, {
      content: '[Storyteller]: The story starts.\n[Rahim - Father]: Let us begin.',
      slug: 'test-story',
      lang: 'en',
    }));

    expect(markup).toContain('aria-label="Story dialogue"');
    expect(markup).toContain('🎙️');
    expect(markup).toContain('Storyteller');
    expect(markup).toContain('The story starts.');
    expect(markup).not.toContain('Let us begin.');
    expect(markup).toContain('Chunk 1 / 2');
    expect(markup).toContain('Next chunk →');
    expect(markup).not.toContain('aria-current="step"');
    expect(markup).toContain('aria-label="Seek through the story"');
    expect(markup).toContain('Learn English by Story');
    expect(markup).toContain('Practice pronunciation');
    expect(markup).toContain('Play this story once online');
    expect(markup).toContain('audio-drama-story-stage');
    expect(markup).not.toContain('Save audio offline');
    expect(markup).not.toContain('Cloudinary');
    expect(markup).not.toContain('ElevenLabs');
    expect(markup).not.toContain('Google TTS');
    expect(markup).not.toContain('3D Audio Drama');
    expect(markup).not.toContain('3D Audio On');
  });

  it('offers English pronunciation practice for Bengali readers when English text is provided', () => {
    const markup = renderToStaticMarkup(createElement(AudioDramaPlayer, {
      content: '[Narrator]: গল্প শুরু হলো।',
      practiceContent: '[Narrator]: The story begins.',
      lang: 'bn',
    }));

    expect(markup).toContain('উচ্চারণ অনুশীলন');
    expect(markup).toContain('গল্প শুরু হলো।');
  });

  it('renders a minimal speaking practice screen with essential controls', () => {
    const markup = renderToStaticMarkup(createElement(AudioDramaPlayer, {
      content: '[Narrator]: The story begins.',
      practiceContent: '[Narrator]: The story begins.',
      startInPracticeMode: true,
      lang: 'en',
    }));

    expect(markup).toContain('Practice speaking story lines');
    expect(markup).not.toContain('Listen · Speak · Grow');
    expect(markup).not.toContain('Sentence difficulty adapts to your progress');
    expect(markup).not.toContain('Sentence 1');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).not.toContain('0 of 3 tries');
    expect(markup).toContain('aria-label="Listen to example"');
    expect(markup).toContain('aria-label="Read and check"');
    expect(markup).toContain('speech-practice-constellation');
    expect(markup).toContain('speech-practice-action-dock');
    expect(markup).toContain('speech-practice-inline-listen');
    expect(markup).toContain('aria-label="Say this sentence"');
    expect(markup).not.toContain('speech-practice-constellation-node');
  });

  it('shows only the current sentence in full-screen practice before asking for microphone access', () => {
    const markup = renderToStaticMarkup(createElement(AudioDramaPlayer, {
      content: '[Narrator]: This story has two sentences.',
      practiceContent: '[Narrator]: The first sentence is short.\n[Narrator]: The second sentence stays hidden.',
      startInPracticeMode: true,
      lang: 'en',
    }));
    const visibleText = markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    expect(markup).toContain('class="audio-drama-player speech-practice-fullscreen');
    expect(visibleText).toContain('The first sentence is short.');
    expect(visibleText).not.toContain('The second sentence stays hidden.');
    expect(markup).not.toContain('Microphone permission');
    expect(markup).toContain('Exit practice');
  });

  it('announces sentence progress in Bengali pronunciation practice', () => {
    const markup = renderToStaticMarkup(createElement(AudioDramaPlayer, {
      content: '[Narrator]: গল্প শুরু হলো।',
      practiceContent: '[Narrator]: The first sentence.\n[Narrator]: The second sentence.',
      startInPracticeMode: true,
      lang: 'bn',
    }));

    expect(markup).toContain('অনুশীলনের অগ্রগতি');
    expect(markup).toContain('>1 / 2</span>');
    expect(markup).toContain('aria-valuenow="50"');
    expect(markup).not.toContain('0 / 3 বার চেষ্টা');
  });

  it('does not offer English pronunciation practice for Bengali-only daily stories', () => {
    const markup = renderToStaticMarkup(createElement(AudioDramaPlayer, {
      content: '[Narrator]: গল্প শুরু হলো।',
      practiceContent: '',
      lang: 'bn',
    }));

    expect(markup).not.toContain('উচ্চারণ অনুশীলন');
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

  it('renders exactly the narration segments sent to the audio generator', () => {
    const content = [
      '[Scene]: The door opens.',
      '[Mina - Adult Female]: I found the key.',
      '[Tariq - Adult Male]: It was under the book.',
    ].join('\n');
    const narrationSegments = parseStoryNarration(content);
    const renderedLines = parseStoryScript(content);

    expect(renderedLines.map(({ text }) => text)).toEqual(narrationSegments.map(({ text }) => text));
    expect(renderedLines.map(({ role }) => narrationSpeakerForRole(role))).toEqual(
      narrationSegments.map(({ speaker }) => narrationSpeakerForRole(speaker)),
    );
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

  it('plays timestamped Cloudinary sentence clips in order and tracks aligned words', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = FakeAudio;
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cached: true,
          segments: [
            {
              url: 'https://res.cloudinary.com/test/sentence-1.mp3',
              text: 'The story begins.',
              durationSeconds: 4,
              words: [{ text: 'The', start: 0, end: 0.5 }, { text: 'story', start: 0.5, end: 1.5 }],
            },
            {
              url: 'https://res.cloudinary.com/test/sentence-2.mp3',
              text: 'Dad lost a shoe.',
              durationSeconds: 4,
              words: [],
            },
          ],
        }),
      });

    const progress = vi.fn();
    const onEnd = vi.fn();
    const onNotice = vi.fn();
    const lines = parseStoryScript('[Storyteller]: The story begins.\n[Father]: Dad lost a shoe.');
    const player = playDrama(lines, progress, onEnd, { lang: 'bn', onNotice });

    player.play();
    await vi.waitFor(() => expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce());
    const [audio] = FakeAudio.instances;
    expect(audio.src).toBe('https://res.cloudinary.com/test/sentence-1.mp3');
    expect(audio.preload).toBe('auto');
    expect(audio.play).toHaveBeenCalledOnce();

    const [csrfUrl] = globalThis.fetch.mock.calls[0];
    const [requestUrl, requestOptions] = globalThis.fetch.mock.calls[1];
    expect(csrfUrl).toBe('/api/auth/csrf');
    expect(globalThis.fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
    expect(requestUrl).toBe('/api/speech/audio-drama');
    expect(requestOptions.headers['X-CSRF-Token']).toBe('test-token');
    expect(JSON.parse(requestOptions.body)).toEqual({
      content: '[Storyteller]: The story begins.\n[Father]: Dad lost a shoe.',
    });
    expect(onNotice).toHaveBeenCalledWith('গল্পের অডিও চালানো হচ্ছে…');

    audio.currentTime = 1;
    audio.ontimeupdate();
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'cloudinary-segments' }));
    expect(progress.mock.lastCall[0].index).toBe(0);
    expect(progress.mock.lastCall[0].wordIndex).toBe(1);
    audio.onended();
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(2));
    const secondAudio = FakeAudio.instances[1];
    expect(secondAudio.src).toBe('https://res.cloudinary.com/test/sentence-2.mp3');
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({
      index: 1,
      wordIndex: -1,
    }));
    player.pause();
    expect(secondAudio.pause).toHaveBeenCalledOnce();
    player.resume();
    expect(secondAudio.play).toHaveBeenCalledTimes(2);

    secondAudio.onended();
    expect(onEnd).toHaveBeenCalledOnce();
    player.close();
  });

  it('does not advance sentence selection before the audio starts playing', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = class extends FakeAudio {
      constructor() {
        super();
        this.play = vi.fn(() => new Promise(() => {}));
      }
    };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          segments: [
            { url: 'https://res.cloudinary.com/test/sentence-1.mp3', durationSeconds: 3, words: [] },
            { url: 'https://res.cloudinary.com/test/sentence-2.mp3', durationSeconds: 3, words: [] },
          ],
        }),
      });
    const progress = vi.fn();
    const player = playDrama(
      parseStoryScript('[Narrator]: First sentence.\n[Narrator]: Second sentence.'),
      progress,
      vi.fn(),
    );

    player.play(1);
    await vi.waitFor(() => expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce());
    expect(progress).not.toHaveBeenCalled();

    const [audio] = FakeAudio.instances;
    audio.paused = false;
    audio.currentTime = 6;
    audio.onplaying();
    expect(progress).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ index: 1 }));
    player.close();
  });

  it('does not advance sentence selection when audio playback fails to start', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = class extends FakeAudio {
      constructor() {
        super();
        this.play = vi.fn(async () => {
          throw new Error('Audio playback failed.');
        });
      }
    };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          segments: [{ url: 'https://res.cloudinary.com/test/sentence.mp3', durationSeconds: 3, words: [] }],
        }),
      });
    const progress = vi.fn();
    const onError = vi.fn();
    const player = playDrama(
      parseStoryScript('[Narrator]: First sentence.\n[Narrator]: Second sentence.'),
      progress,
      vi.fn(),
      { onError },
    );

    player.play(1);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());

    expect(progress).not.toHaveBeenCalled();
    player.close();
  });

  it('plays the free TTS fallback when Cloudinary generation is unavailable', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = FakeAudio;
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:story-audio'),
      revokeObjectURL: vi.fn(),
    });
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: 'not configured' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer });

    const player = playDrama(
      parseStoryScript('[Storyteller]: The story begins.\n[Father]: Dad lost a shoe.'),
      vi.fn(),
      vi.fn(),
    );
    player.play();

    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    expect(FakeAudio.instances[0].src).toBe('blob:story-audio');
    expect(FakeAudio.instances[0].play).toHaveBeenCalledOnce();
    expect(globalThis.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/csrf',
      '/api/speech/audio-drama',
      '/api/auth/csrf',
      '/api/speech/audio-drama/free',
    ]);
    player.close();
  });


  it('plays an existing Cloudinary narration without requesting another generation', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = FakeAudio;
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cached: true,
          segments: [{
            url: 'https://res.cloudinary.com/test/daily-lesson-sentence-1.mp3',
            text: 'The story begins.',
            durationSeconds: 3,
            words: [],
          }],
        }),
      });
    const onNotice = vi.fn();
    const player = playDrama(
      parseStoryScript('[Storyteller]: The story begins.'),
      vi.fn(),
      vi.fn(),
      { audioUrl: 'https://res.cloudinary.com/test/daily-lesson.mp3', onNotice },
    );

    player.play();
    await vi.waitFor(() => expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce());

    expect(FakeAudio.instances[0].src).toBe('https://res.cloudinary.com/test/daily-lesson-sentence-1.mp3');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(onNotice).toHaveBeenCalledWith('গল্পের অডিও চালানো হচ্ছে…');
    player.close();
  });

  it('stops the previous story player before starting another one', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = FakeAudio;
    globalThis.fetch = vi.fn(async (url) => (url === '/api/auth/csrf'
      ? { ok: true, json: async () => ({ csrfToken: 'test-token' }) }
      : {
        ok: true,
        json: async () => ({
          segments: [{ url: 'https://res.cloudinary.com/test/audio-sentence.mp3', durationSeconds: 3, words: [] }],
        }),
      }));

    const onStop = vi.fn();
    const firstPlayer = playDrama(parseStoryScript('[Narrator]: First story.'), vi.fn(), vi.fn(), { onStop });
    firstPlayer.play();
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    const firstAudio = FakeAudio.instances[0];

    const secondPlayer = playDrama(parseStoryScript('[Narrator]: Second story.'), vi.fn(), vi.fn());
    secondPlayer.play();
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(2));

    expect(firstAudio.pause).toHaveBeenCalledOnce();
    expect(onStop).toHaveBeenCalledOnce();
    expect(FakeAudio.instances[1].play).toHaveBeenCalledOnce();
    firstPlayer.close();
    secondPlayer.close();
  });

  it('stops story narration before playing a sentence with device speech', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = FakeAudio;
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'test-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          segments: [{
            url: 'https://res.cloudinary.com/test/story-sentence.mp3',
            durationSeconds: 3,
            words: [],
          }],
        }),
      });
    const speechSynthesis = {
      getVoices: () => [{ name: 'Google US English', lang: 'en-US' }],
      cancel: vi.fn(),
      speak: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    };
    globalThis.window = { speechSynthesis };
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = text; }
    };

    const story = playDrama(
      parseStoryScript('[Narrator]: The story continues.'),
      vi.fn(),
      vi.fn(),
    );
    story.play();
    await vi.waitFor(() => expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce());

    const sentence = speakWithVoice('Listen to this sentence.');

    expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
    expect(speechSynthesis.speak).toHaveBeenCalledOnce();
    expect(speechSynthesis.speak.mock.calls[0][0].text).toBe('Listen to this sentence.');

    sentence.stop();
    story.close();
  });

  it('plays downloaded story audio without making a network request while offline', async () => {
    FakeAudio.instances = [];
    globalThis.Audio = FakeAudio;
    globalThis.fetch = vi.fn();
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:offline-story'),
      revokeObjectURL: vi.fn(),
    });
    const onNotice = vi.fn();
    const player = playDrama(
      parseStoryScript('[Storyteller]: The story begins.'),
      vi.fn(),
      vi.fn(),
      {
        lang: 'en',
        offlineAudio: new Blob(['audio'], { type: 'audio/mpeg' }),
        onNotice,
      },
    );

    player.play();
    await vi.waitFor(() => expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce());

    expect(FakeAudio.instances[0].src).toBe('blob:offline-story');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith('Playing audio saved on this device.');
    player.close();
  });
});
