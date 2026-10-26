import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CloudinaryApiError,
  configureCloudinary,
  setCloudinaryClient,
} from '../../src/services/cloudinary.js';
import { audioDramaError, elevenLabsError } from '../../src/routes/speech.js';
import {
  ElevenLabsApiError,
  DEFAULT_ELEVENLABS_VOICES,
  buildElevenLabsDialogueRequest,
  generateAndUploadLessonAudio,
  generateAndUploadAudioDrama,
  generateElevenLabsAudio,
  generateElevenLabsAudioWithTimestamps,
  generateNarrationAudio,
  hasCompleteNarrationVoiceConfig,
  isBengaliStoryContent,
  parseNarrationSegments,
  resolveNarrationVoice,
  withDefaultNarrationVoices,
} from '../../src/services/elevenLabs.js';
import { hasCompleteStoryScript } from '../../src/services/geminiLessons.js';
import { parseStoryNarration } from '@smart-routine/shared';

const config = {
  ELEVENLABS_API_KEY: 'test-elevenlabs-key',
  ELEVENLABS_MODEL: 'eleven_v3',
  ELEVENLABS_FATHER_VOICE_ID: 'father-voice',
  ELEVENLABS_MOTHER_VOICE_ID: 'mother-voice',
  ELEVENLABS_SON_VOICE_ID: 'son-voice',
  ELEVENLABS_STORYTELLER_VOICE_ID: 'storyteller-voice',
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-cloud-key',
  CLOUDINARY_API_SECRET: 'test-cloud-secret',
};

afterEach(() => {
  configureCloudinary({});
  vi.unstubAllGlobals();
});

describe('ElevenLabs provider errors', () => {
  it('keeps only the HTTP status and provider error code for safe route mapping', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 402,
      json: async () => ({
        detail: {
          status: 'quota_exceeded',
          message: 'Private provider detail should not escape.',
        },
      }),
    })));

    const error = await generateElevenLabsAudio({
      text: 'test',
      speaker: 'father',
      config,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ElevenLabsApiError);
    expect(error).toMatchObject({ status: 402, upstreamCode: 'quota_exceeded' });
    expect(error.message).not.toContain('Private provider detail');
    expect(elevenLabsError(error)).toMatchObject({
      status: 402,
      code: 'PAYMENT_REQUIRED',
      i18n: {
        bn: 'ElevenLabs-এর ব্যবহারযোগ্য credit শেষ। credit যোগ করে আবার চেষ্টা করুন।',
      },
    });
    expect(elevenLabsError(new ElevenLabsApiError(429, 'rate_limit_exceeded'))).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('reports rejected Cloudinary credentials before making any paid TTS request', async () => {
    configureCloudinary(config);
    setCloudinaryClient({
      resourceInfo: vi.fn(async () => {
        throw new CloudinaryApiError('lookup', 401);
      }),
      uploadBuffer: vi.fn(),
    });
    const providerRequest = vi.fn();
    vi.stubGlobal('fetch', providerRequest);

    const error = await generateAndUploadAudioDrama({
      content: '[Storyteller]: The story begins.',
      config,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(CloudinaryApiError);
    expect(audioDramaError(error)).toMatchObject({
      status: 502,
      code: 'CLOUDINARY_UNAVAILABLE',
      i18n: {
        en: expect.stringContaining('Cloudinary rejected its credentials'),
      },
    });
    expect(providerRequest).not.toHaveBeenCalled();
  });
});

describe('English-only cached ElevenLabs audio policy', () => {
  it('detects Bengali text and fills the configured English voice defaults', () => {
    expect(isBengaliStoryContent('[Storyteller]: গল্প শুরু হলো।')).toBe(true);
    expect(isBengaliStoryContent('[Storyteller]: The story begins.')).toBe(false);
    expect(withDefaultNarrationVoices({})).toMatchObject({
      ELEVENLABS_FATHER_VOICE_ID: DEFAULT_ELEVENLABS_VOICES.father,
      ELEVENLABS_MOTHER_VOICE_ID: DEFAULT_ELEVENLABS_VOICES.mother,
      ELEVENLABS_SON_VOICE_ID: 'TxGEqnHWrfWFTfGW9XjX',
      ELEVENLABS_STORYTELLER_VOICE_ID: DEFAULT_ELEVENLABS_VOICES.storyteller,
    });
  });

  it('refuses Bengali before requesting provider or Cloudinary audio', async () => {
    const providerRequest = vi.fn();
    vi.stubGlobal('fetch', providerRequest);

    const lessonError = await generateAndUploadLessonAudio({
      lesson: { content: '[Storyteller]: বাংলা গল্প।' },
      config,
    }).catch((caught) => caught);
    const dramaError = await generateAndUploadAudioDrama({
      content: '[Storyteller]: বাংলা গল্প।',
      config,
    }).catch((caught) => caught);

    expect(lessonError).toMatchObject({ status: 503, upstreamCode: 'english_only_policy' });
    expect(dramaError).toMatchObject({ status: 503, upstreamCode: 'english_only_policy' });
    expect(providerRequest).not.toHaveBeenCalled();
  });

  it('retries failed eleven_v3 timestamps with the lower-cost turbo model', async () => {
    configureCloudinary(config);
    const assets = new Map();
    const uploadBuffer = vi.fn(async ({ publicId, folder, resourceType, format, buffer }) => {
      const asset = {
        secure_url: `https://media.example/${publicId}.${format}`,
        public_id: `${folder}/${publicId}`,
        duration: 1,
        buffer,
      };
      assets.set(`${resourceType}/${folder}/${publicId}`, asset);
      return asset;
    });
    setCloudinaryClient({
      resourceInfo: vi.fn(async (publicId, resourceType) => assets.get(`${resourceType}/${publicId}`) || null),
      uploadBuffer,
    });
    const modelIds = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options = {}) => {
      const { text, model_id: modelId } = JSON.parse(options.body);
      modelIds.push(modelId);
      if (modelId === 'eleven_v3') {
        return {
          ok: false,
          status: 400,
          json: async () => ({ detail: { status: 'model_error' } }),
        };
      }
      const characters = [...text];
      return {
        ok: true,
        json: async () => ({
          audio_base64: Buffer.from([1, 2, 3]).toString('base64'),
          alignment: {
            characters,
            character_start_times_seconds: characters.map((_, index) => index / 10),
            character_end_times_seconds: characters.map((_, index) => (index + 1) / 10),
          },
        }),
      };
    }));

    const result = await generateAndUploadAudioDrama({
      content: '[Storyteller]: The story begins.',
      config,
    });

    expect(modelIds).toEqual(['eleven_v3', 'eleven_turbo_v2_5']);
    expect(result.cached).toBe(false);
    expect(uploadBuffer).toHaveBeenCalledTimes(2);
  });
});

describe('Daily lesson narration', () => {
  it('requests real character timings from the ElevenLabs timestamp endpoint', async () => {
    const providerRequest = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        audio_base64: Buffer.from([1, 2, 3]).toString('base64'),
        alignment: {
          characters: ['H', 'i', ' ', 't', 'h', 'e', 'r', 'e', '.'],
          character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
          character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
        },
      }),
    }));
    vi.stubGlobal('fetch', providerRequest);

    const result = await generateElevenLabsAudioWithTimestamps({
      text: 'Hi there.',
      speaker: 'storyteller',
      config,
    });

    expect(providerRequest.mock.calls[0][0]).toContain('/text-to-speech/storyteller-voice/with-timestamps?output_format=mp3_44100_128');
    expect(providerRequest.mock.calls[0][1].headers.Accept).toBe('application/json');
    expect(JSON.parse(providerRequest.mock.calls[0][1].body)).not.toHaveProperty('output_format');
    expect(result.audioBuffer).toEqual(Buffer.from([1, 2, 3]));
    expect(result.alignment.characters).toHaveLength(9);
  });

  it('parses family speakers into ordered narration segments', () => {
    expect(parseNarrationSegments([
      '[Rahim - Father]: First line.',
      '[Asha - Mother]: Second line.',
      '[Rafi - Child]: Third line.',
      '[Storyteller]: Closing line.',
    ].join('\n')).map(({ speaker, text }) => ({ speaker, text }))).toEqual([
      { speaker: 'father', text: 'First line.' },
      { speaker: 'mother', text: 'Second line.' },
      { speaker: 'son', text: 'Third line.' },
      { speaker: 'storyteller', text: 'Closing line.' },
    ]);
  });

  it('uses the same text segments for the screen and generated audio', () => {
    const content = [
      '[Scene]: The door opens.',
      '[Mina - Adult Female]: I found the key.',
      '[Tariq - Adult Male]: It was under the book.',
    ].join('\n');

    expect(parseNarrationSegments(content).map(({ speaker, text }) => ({ speaker, text }))).toEqual(
      parseStoryNarration(content).map(({ speaker, text }) => ({ speaker, text })),
    );
  });

  it('does not add audio-only framing to untagged stories', () => {
    expect(parseNarrationSegments('A plain story line.').map(({ text }) => text))
      .toEqual(['A plain story line.']);
  });

  it('routes storyteller and Bengali storyteller tags to the dedicated voice', () => {
    expect(resolveNarrationVoice(config, 'Storyteller')).toBe('storyteller-voice');
    expect(resolveNarrationVoice(config, 'গল্পকথক')).toBe('storyteller-voice');
    expect(resolveNarrationVoice({ ...config, ELEVENLABS_MOTHER_VOICE_ID: undefined }, 'mother')).toBeNull();
    expect(resolveNarrationVoice({ ...config, ELEVENLABS_STORYTELLER_VOICE_ID: undefined }, 'storyteller')).toBeNull();
  });

  it('requires four distinct voice IDs for the character roles', () => {
    expect(hasCompleteNarrationVoiceConfig(config)).toBe(true);
    expect(hasCompleteNarrationVoiceConfig({
      ...config,
      ELEVENLABS_STORYTELLER_VOICE_ID: config.ELEVENLABS_FATHER_VOICE_ID,
    })).toBe(false);
  });

  it('builds one dialogue request with a distinct configured voice for each speaker role', () => {
    const segments = [
      { speaker: 'storyteller', text: 'A story starts.' },
      { speaker: 'father', text: 'I found a clue.' },
      { speaker: 'mother', text: 'Let us check.' },
      { speaker: 'son', text: 'It was under my book!' },
    ];
    const request = buildElevenLabsDialogueRequest({ segments, config });

    expect(request.url).toBe('https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128');
    expect(JSON.parse(request.body)).toMatchObject({
      model_id: 'eleven_v3',
      inputs: [
        { text: 'A story starts.', voice_id: 'storyteller-voice' },
        { text: 'I found a clue.', voice_id: 'father-voice' },
        { text: 'Let us check.', voice_id: 'mother-voice' },
        { text: 'It was under my book!', voice_id: 'son-voice' },
      ],
    });
  });

  it('accepts randomly named characters with role-based voice tags', () => {
    const content = [
      '[Mina - Adult Female]: The kettle is singing again.',
      '[Tariq - Adult Male]: It thinks it is in a choir.',
      '[Nila - Child]: Then it needs to practise quietly.',
      '[Storyteller]: They laughed and made a plan.',
    ].join('\n');

    expect(parseNarrationSegments(content).map(({ speaker }) => speaker)).toEqual([
      'mother',
      'father',
      'son',
      'storyteller',
    ]);
    expect(hasCompleteStoryScript([
      '[Storyteller]: A new story begins.',
      '[Mina - Adult Female]: I have an idea.',
      '[Tariq - Adult Male]: Let us try it.',
      '[Nila - Child]: I can help.',
      '[Storyteller]: They start together.',
      '[Storyteller]: That is the end.',
    ].join('\n'))).toBe(true);
  });

  it('rejects dialogue that exceeds ElevenLabs multi-voice character limit', () => {
    expect(() => buildElevenLabsDialogueRequest({
      segments: [{ speaker: 'storyteller', text: 'a'.repeat(2001) }],
      config,
    })).toThrow(/2000 text characters/);
  });

  it('adds Bengali storyteller framing when narrating an older saved story', () => {
    expect(parseNarrationSegments('[Rahim - Father]: চলুন শুরু করি।').map(({ speaker, text }) => ({ speaker, text }))).toEqual([
      { speaker: 'storyteller', text: 'গল্পটি শুরু হচ্ছে।' },
      { speaker: 'father', text: 'চলুন শুরু করি।' },
      { speaker: 'storyteller', text: 'এরপর তারা একসঙ্গে সমাধান খুঁজতে থাকে।' },
      { speaker: 'storyteller', text: 'এই ছিল আজকের গল্প।' },
    ]);
  });

  it('requires a storyteller opening, middle transition, and closing in generated scripts', () => {
    const complete = [
      '[Storyteller]: গল্প শুরু।',
      '[Rahim - Father]: প্রথম কথা।',
      '[Asha - Mother]: দ্বিতীয় কথা।',
      '[Storyteller]: মাঝের কথা।',
      '[Rafi - Child]: তৃতীয় কথা।',
      '[Storyteller]: গল্প শেষ।',
    ].join('\n');
    expect(hasCompleteStoryScript(complete)).toBe(true);
    expect(hasCompleteStoryScript(complete.replace('[Storyteller]: মাঝের কথা।\n', ''))).toBe(false);
  });

  it('generates a whole lesson with one multi-voice ElevenLabs request', async () => {
    const uploadBuffer = vi.fn(async ({ buffer, publicId }) => ({
      secure_url: 'https://media.example/family-story.mp3',
      public_id: `smart-routine/daily-lessons/${publicId}`,
      bytes: buffer.length,
    }));
    configureCloudinary(config);
    setCloudinaryClient({
      resourceInfo: vi.fn(async () => null),
      uploadBuffer,
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    })));

    const audio = await generateAndUploadLessonAudio({
      lesson: {
        slug: 'family-focus',
        content: '[Storyteller]: The story begins.\n[Rahim - Father]: Start small.\n[Asha - Mother]: Keep going.',
      },
      config,
    });

    expect(audio).toMatchObject({
      status: 'ready',
      url: 'https://media.example/family-story.mp3',
      publicId: expect.stringMatching(/^smart-routine\/daily-lessons\/family-focus-[a-f0-9]{20}$/),
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toContain('/text-to-dialogue?');
    expect(JSON.parse(fetch.mock.calls[0][1].body).inputs.map(({ voice_id }) => voice_id)).toEqual([
      'storyteller-voice',
      'father-voice',
      'mother-voice',
    ]);
    expect(uploadBuffer).toHaveBeenCalledTimes(1);
    expect(uploadBuffer.mock.calls[0][0].buffer).toEqual(Buffer.from([1, 2, 3]));
  });

  it('reuses an existing Cloudinary asset without calling ElevenLabs again', async () => {
    const resourceInfo = vi.fn(async () => ({
      secure_url: 'https://media.example/already-generated.mp3',
      public_id: 'smart-routine/daily-lessons/family-focus-existing',
      duration: 42,
    }));
    configureCloudinary(config);
    setCloudinaryClient({
      resourceInfo,
      uploadBuffer: vi.fn(),
    });
    const providerRequest = vi.fn();
    vi.stubGlobal('fetch', providerRequest);

    const audio = await generateAndUploadLessonAudio({
      lesson: { slug: 'family-focus', content: '[Rahim - Father]: Keep it simple.' },
      config,
    });

    expect(audio).toMatchObject({
      status: 'ready',
      url: 'https://media.example/already-generated.mp3',
      publicId: 'smart-routine/daily-lessons/family-focus-existing',
      durationSeconds: 42,
    });
    expect(resourceInfo).toHaveBeenCalledOnce();
    expect(providerRequest).not.toHaveBeenCalled();
  });

  it('generates timestamped sentence clips and a reusable Cloudinary manifest', async () => {
    configureCloudinary(config);
    const assets = new Map();
    const uploadBuffer = vi.fn(async ({ buffer, publicId, folder, resourceType: _resourceType, format }) => {
      const asset = {
        secure_url: `https://media.example/${publicId}.${format}`,
        bytes: buffer.length,
        buffer,
      };
      assets.set(`${folder}/${publicId}`, asset);
      return asset;
    });
    const resourceInfo = vi.fn(async (publicId) => assets.get(publicId) || null);
    setCloudinaryClient({ resourceInfo, uploadBuffer });
    const providerRequest = vi.fn(async (url, options = {}) => {
      if (url.startsWith('https://media.example/')) {
        const publicId = url.split('/').at(-1).replace(/\.json$/, '');
        return {
          ok: true,
          json: async () => JSON.parse(assets.get(`smart-routine/audio-dramas/${publicId}`).buffer.toString()),
        };
      }
      const text = JSON.parse(options.body).text;
      const characters = [...text];
      return {
        ok: true,
        json: async () => ({
          audio_base64: Buffer.from([1, 2, 3]).toString('base64'),
          alignment: {
            characters,
            character_start_times_seconds: characters.map((_, index) => index / 10),
            character_end_times_seconds: characters.map((_, index) => (index + 1) / 10),
          },
        }),
      };
    });
    vi.stubGlobal('fetch', providerRequest);
    const content = [
      '[Storyteller]: The story begins.',
      '[Father]: Dad lost his tiny shoe.',
      '[Storyteller]: They checked the kitchen.',
      '[Mother]: Mum found it inside a lunchbox.',
      '[Storyteller]: Everyone laughed and made a plan.',
    ].join('\n');

    const first = await generateAndUploadAudioDrama({ content, config });

    expect(first).toMatchObject({
      segments: expect.arrayContaining([
        expect.objectContaining({
          text: 'The story begins.',
          url: expect.stringMatching(/sentence-1\.mp3$/),
          words: expect.arrayContaining([expect.objectContaining({ text: 'The' })]),
        }),
      ]),
      cached: false,
    });
    expect(first.segments).toHaveLength(5);
    expect(providerRequest).toHaveBeenCalledTimes(5);
    expect(uploadBuffer).toHaveBeenCalledTimes(6);

    const second = await generateAndUploadAudioDrama({ content, config });

    expect(second).toEqual({ segments: first.segments, cached: true });
    expect(providerRequest).toHaveBeenCalledTimes(6);
    expect(uploadBuffer).toHaveBeenCalledTimes(6);
  });

  it('reuses a previously saved story when the ElevenLabs API key is absent', async () => {
    configureCloudinary(config);
    const manifest = {
      version: 'sentence-alignment-v1',
      segments: [{ text: 'The story begins.', url: 'https://media.example/sentence.mp3', words: [] }],
    };
    const resourceInfo = vi.fn(async () => ({
      secure_url: 'https://media.example/previous-manifest.json',
    }));
    setCloudinaryClient({
      resourceInfo,
      uploadBuffer: vi.fn(),
    });
    const providerRequest = vi.fn(async () => ({ ok: true, json: async () => manifest }));
    vi.stubGlobal('fetch', providerRequest);

    const result = await generateAndUploadAudioDrama({
      content: '[Storyteller]: The story begins.',
      config: { ...config, ELEVENLABS_API_KEY: undefined },
    });

    expect(result).toEqual({
      segments: manifest.segments,
      cached: true,
    });
    expect(resourceInfo).toHaveBeenCalledOnce();
    expect(providerRequest).toHaveBeenCalledOnce();
  });

  it('reports a clear configuration error on an uncached story when the ElevenLabs key is absent', async () => {
    configureCloudinary(config);
    setCloudinaryClient({
      resourceInfo: vi.fn(async () => null),
      uploadBuffer: vi.fn(),
    });
    const providerRequest = vi.fn();
    vi.stubGlobal('fetch', providerRequest);

    const error = await generateAndUploadAudioDrama({
      content: '[Storyteller]: A new story.',
      config: { ...config, ELEVENLABS_API_KEY: undefined },
    }).catch((caught) => caught);

    expect(error).toMatchObject({ status: 503, upstreamCode: 'api_key_not_configured' });
    expect(audioDramaError(error)).toMatchObject({ status: 503, code: 'UNAVAILABLE' });
    expect(providerRequest).not.toHaveBeenCalled();
  });

  it('sends the complete story to ElevenLabs in one call', async () => {
    const providerRequest = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([4, 5, 6]).buffer,
    }));
    vi.stubGlobal('fetch', providerRequest);

    const result = await generateNarrationAudio({
      lesson: { content: [
        '[Storyteller]: The story begins.',
        '[Father]: First sentence.',
        '[Mother]: Second sentence.',
        '[Storyteller]: The story ends.',
      ].join('\n') },
      config,
    });

    expect(providerRequest).toHaveBeenCalledOnce();
    const dialogue = JSON.parse(providerRequest.mock.calls[0][1].body);
    expect(dialogue.inputs).toEqual([
      { text: 'The story begins.', voice_id: 'storyteller-voice' },
      { text: 'First sentence.', voice_id: 'father-voice' },
      { text: 'Second sentence.', voice_id: 'mother-voice' },
      { text: 'The story ends.', voice_id: 'storyteller-voice' },
    ]);
    expect(result.audioBuffer).toEqual(Buffer.from([4, 5, 6]));
  });

});
