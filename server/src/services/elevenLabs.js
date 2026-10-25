import crypto from 'node:crypto';
import { parseStoryNarration, parseNarrationSpeakerName as parseSharedNarrationSpeakerName } from '@smart-routine/shared';
import { cloudinary, uploadBufferToCloudinary } from './cloudinary.js';

export const ELEVEN_LABS_BASE_URL = 'https://api.elevenlabs.io/v1';

export const DEFAULT_ELEVENLABS_VOICES = Object.freeze({
  father: 'pNInz6obpgDQGcFmaJgB',
  mother: 'EXAVITQu4vr4xnSDxMaL',
  son: 'TxGEqnHWrfWFTfGW9XjX',
  storyteller: 'JBFqnCBsd6RMkjVDRZzb',
});

export class ElevenLabsApiError extends Error {
  constructor(status, code) {
    super(`ElevenLabs request failed (${status}, ${code || 'unknown'}).`);
    this.name = 'ElevenLabsApiError';
    this.status = status;
    this.upstreamCode = code || 'unknown';
  }
}

export function isBengaliStoryContent(text = '') {
  return /[\u0980-\u09FF]/u.test(String(text ?? ''));
}

const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};

export const NARRATION_AUDIO_VERSION = 'sentence-alignment-v1';

export function getNarrationVoiceConfigVersion(config) {
  return [
    NARRATION_AUDIO_VERSION,
    config.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
    config.ELEVENLABS_FATHER_VOICE_ID || '',
    config.ELEVENLABS_MOTHER_VOICE_ID || '',
    config.ELEVENLABS_SON_VOICE_ID || '',
    config.ELEVENLABS_STORYTELLER_VOICE_ID || '',
    config.ELEVENLABS_STABILITY ?? DEFAULT_VOICE_SETTINGS.stability,
    config.ELEVENLABS_SIMILARITY_BOOST ?? DEFAULT_VOICE_SETTINGS.similarity_boost,
    config.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128',
  ].join(':');
}

export function hasCompleteNarrationVoiceConfig(config) {
  const voiceIds = [
    config?.ELEVENLABS_FATHER_VOICE_ID,
    config?.ELEVENLABS_MOTHER_VOICE_ID,
    config?.ELEVENLABS_SON_VOICE_ID,
    config?.ELEVENLABS_STORYTELLER_VOICE_ID,
  ];
  return voiceIds.every((voiceId) => typeof voiceId === 'string' && voiceId.length > 0)
    && new Set(voiceIds).size === voiceIds.length;
}

export function withDefaultNarrationVoices(config = {}) {
  return {
    ...config,
    ELEVENLABS_FATHER_VOICE_ID: config.ELEVENLABS_FATHER_VOICE_ID || DEFAULT_ELEVENLABS_VOICES.father,
    ELEVENLABS_MOTHER_VOICE_ID: config.ELEVENLABS_MOTHER_VOICE_ID || DEFAULT_ELEVENLABS_VOICES.mother,
    ELEVENLABS_SON_VOICE_ID: config.ELEVENLABS_SON_VOICE_ID || DEFAULT_ELEVENLABS_VOICES.son,
    ELEVENLABS_STORYTELLER_VOICE_ID: config.ELEVENLABS_STORYTELLER_VOICE_ID || DEFAULT_ELEVENLABS_VOICES.storyteller,
  };
}

export function parseNarrationSpeakerName(value) {
  return parseSharedNarrationSpeakerName(value);
}

export function resolveNarrationVoice(config, speaker) {
  const resolvedSpeaker = parseNarrationSpeakerName(speaker);
  const voiceIdMap = {
    father: config.ELEVENLABS_FATHER_VOICE_ID,
    male: config.ELEVENLABS_FATHER_VOICE_ID,
    rahim: config.ELEVENLABS_FATHER_VOICE_ID,
    mother: config.ELEVENLABS_MOTHER_VOICE_ID,
    female: config.ELEVENLABS_MOTHER_VOICE_ID,
    asha: config.ELEVENLABS_MOTHER_VOICE_ID,
    son: config.ELEVENLABS_SON_VOICE_ID,
    child: config.ELEVENLABS_SON_VOICE_ID,
    rafi: config.ELEVENLABS_SON_VOICE_ID,
    storyteller: config.ELEVENLABS_STORYTELLER_VOICE_ID,
    narrator: config.ELEVENLABS_STORYTELLER_VOICE_ID,
  };

  return voiceIdMap[resolvedSpeaker] || null;
}

export function parseNarrationSegments(content = '', defaultSpeaker = 'Narrator') {
  return parseStoryNarration(content, defaultSpeaker).map(({ speaker, character, text }) => ({
    speaker,
    character,
    text,
    rawLine: text,
  }));
}

export function buildElevenLabsRequest({ text, speaker, config }) {
  const voiceId = resolveNarrationVoice(config, speaker);
  if (!voiceId) {
    throw new Error('ElevenLabs voice configuration is missing for the selected speaker.');
  }

  const stability = Number(config.ELEVENLABS_STABILITY ?? DEFAULT_VOICE_SETTINGS.stability);
  const similarityBoost = Number(config.ELEVENLABS_SIMILARITY_BOOST ?? DEFAULT_VOICE_SETTINGS.similarity_boost);
  return {
    method: 'POST',
    url: `${ELEVEN_LABS_BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}`,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
      'xi-api-key': config.ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: config.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
      voice_settings: {
        ...DEFAULT_VOICE_SETTINGS,
        stability: Number.isFinite(stability) ? Math.min(1, Math.max(0, stability)) : DEFAULT_VOICE_SETTINGS.stability,
        similarity_boost: Number.isFinite(similarityBoost) ? Math.min(1, Math.max(0, similarityBoost)) : DEFAULT_VOICE_SETTINGS.similarity_boost,
      },
      output_format: config.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128',
    }),
  };
}

export function buildElevenLabsTimestampRequest({ text, speaker, config }) {
  const request = buildElevenLabsRequest({ text, speaker, config });
  const body = JSON.parse(request.body);
  delete body.output_format;
  return {
    ...request,
    url: `${request.url}/with-timestamps?output_format=${encodeURIComponent(config.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128')}`,
    body: JSON.stringify(body),
    headers: { ...request.headers, Accept: 'application/json' },
  };
}

export async function generateElevenLabsAudio({ text, speaker, config, signal }) {
  if (isBengaliStoryContent(text)) {
    throw new ElevenLabsApiError(503, 'english_only_policy');
  }
  if (!config.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured.');
  }

  const normalizedText = typeof text === 'string' ? text.trim() : '';
  if (!normalizedText) {
    throw new Error('A non-empty text payload is required for ElevenLabs narration.');
  }

  const request = buildElevenLabsRequest({ text: normalizedText, speaker, config });
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const providerCode = body?.detail?.code || body?.detail?.status || body?.detail?.type || '';
    const code = typeof providerCode === 'string'
      ? providerCode.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64)
      : '';
    throw new ElevenLabsApiError(response.status, code);
  }

  return response.arrayBuffer();
}

export async function generateElevenLabsAudioWithTimestamps({ text, speaker, config, signal }) {
  if (isBengaliStoryContent(text)) {
    throw new ElevenLabsApiError(503, 'english_only_policy');
  }
  if (!config.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured.');
  }

  const request = buildElevenLabsTimestampRequest({ text, speaker, config });
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const providerCode = body?.detail?.code || body?.detail?.status || body?.detail?.type || '';
    const code = typeof providerCode === 'string'
      ? providerCode.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64)
      : '';
    throw new ElevenLabsApiError(response.status, code);
  }

  const result = await response.json();
  const audioBuffer = Buffer.from(result?.audio_base64 || '', 'base64');
  const alignment = result?.alignment || result?.normalized_alignment;
  if (
    !audioBuffer.length
    || !Array.isArray(alignment?.characters)
    || !Array.isArray(alignment?.character_start_times_seconds)
    || !Array.isArray(alignment?.character_end_times_seconds)
    || alignment.characters.length !== alignment.character_start_times_seconds.length
    || alignment.characters.length !== alignment.character_end_times_seconds.length
  ) {
    throw new Error('ElevenLabs returned audio without usable character timestamps.');
  }

  return { audioBuffer, alignment };
}

function splitNarrationSentences(text) {
  return String(text || '').match(/[^.!?।]+(?:[.!?।]+|$)/gu)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
}

function wordTimingsFromAlignment(text, alignment) {
  const characters = [...text];
  const sourceChars = characters.length === alignment.characters.length
    ? characters
    : alignment.characters;

  const timings = [];
  let word = '';
  let start = null;
  let end = null;
  const finishWord = () => {
    if (word && start !== null && end !== null) timings.push({ text: word, start, end });
    word = '';
    start = null;
    end = null;
  };

  sourceChars.forEach((character, index) => {
    if (/\s/u.test(character)) {
      finishWord();
      return;
    }
    word += character;
    const charStart = alignment.character_start_times_seconds[index];
    const charEnd = alignment.character_end_times_seconds[index];
    if (Number.isFinite(charStart)) start = start === null ? charStart : Math.min(start, charStart);
    if (Number.isFinite(charEnd)) end = end === null ? charEnd : Math.max(end, charEnd);
  });
  finishWord();

  if (!timings.length && text.trim()) {
    const fallbackWords = text.trim().split(/\s+/);
    const maxEnd = Math.max(1, ...(alignment.character_end_times_seconds || []).filter(Number.isFinite));
    const step = maxEnd / fallbackWords.length;
    return fallbackWords.map((w, idx) => ({
      text: w,
      start: Number((idx * step).toFixed(3)),
      end: Number(((idx + 1) * step).toFixed(3)),
    }));
  }

  return timings;
}

export function buildElevenLabsDialogueRequest({ segments, config }) {
  const inputs = segments.map(({ speaker, text }) => {
    const voiceId = resolveNarrationVoice(config, speaker);
    if (!voiceId) {
      throw new Error(`ElevenLabs voice configuration is missing for ${speaker}.`);
    }
    return { text, voice_id: voiceId };
  });
  const totalCharacters = inputs.reduce((total, input) => total + input.text.length, 0);
  if (totalCharacters > 2000) {
    throw new Error('ElevenLabs dialogue is limited to 2000 text characters per story.');
  }

  const stability = Number(config.ELEVENLABS_STABILITY ?? DEFAULT_VOICE_SETTINGS.stability);
  const similarity = Number(config.ELEVENLABS_SIMILARITY_BOOST ?? DEFAULT_VOICE_SETTINGS.similarity_boost);
  const outputFormat = config.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';
  return {
    method: 'POST',
    url: `${ELEVEN_LABS_BASE_URL}/text-to-dialogue?output_format=${encodeURIComponent(outputFormat)}`,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
      'xi-api-key': config.ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      inputs,
      model_id: config.ELEVENLABS_MODEL || 'eleven_v3',
      settings: {
        stability: Number.isFinite(stability) ? Math.min(1, Math.max(0, stability)) : DEFAULT_VOICE_SETTINGS.stability,
        similarity: Number.isFinite(similarity) ? Math.min(1, Math.max(0, similarity)) : DEFAULT_VOICE_SETTINGS.similarity_boost,
      },
    }),
  };
}

async function requestElevenLabsAudio(request, signal) {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const providerCode = body?.detail?.code || body?.detail?.status || body?.detail?.type || '';
    const code = typeof providerCode === 'string'
      ? providerCode.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64)
      : '';
    throw new ElevenLabsApiError(response.status, code);
  }

  return response.arrayBuffer();
}

export async function generateElevenLabsDialogue({ segments, config, signal }) {
  if (segments.some(({ text }) => isBengaliStoryContent(text))) {
    throw new ElevenLabsApiError(503, 'english_only_policy');
  }
  if (!config.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured.');
  }
  if (!Array.isArray(segments) || !segments.length) {
    throw new Error('At least one dialogue segment is required for ElevenLabs narration.');
  }

  const request = buildElevenLabsDialogueRequest({ segments, config });
  return requestElevenLabsAudio(request, signal);
}

export async function generateNarrationAudio({ lesson, config, signal }) {
  if (isBengaliStoryContent(lesson?.content)) {
    throw new ElevenLabsApiError(503, 'english_only_policy');
  }
  const segments = parseNarrationSegments(lesson?.content || '');
  if (!segments.length) {
    throw new Error('The lesson content does not contain any narration segments.');
  }

  const audio = await generateElevenLabsDialogue({ segments, config, signal });
  const audioBuffer = Buffer.from(await audio);
  return {
    segments,
    count: segments.length,
    audioBuffer,
  };
}

export async function generateDirectElevenLabsSpeech({ text, speaker = 'storyteller', config = {}, signal }) {
  if (isBengaliStoryContent(text)) {
    throw new ElevenLabsApiError(503, 'english_only_policy');
  }
  const effectiveConfig = withDefaultNarrationVoices(config);
  try {
    const buffer = await generateElevenLabsAudio({
      text,
      speaker,
      config: effectiveConfig,
      signal,
    });
    return Buffer.from(buffer);
  } catch (err) {
    if (effectiveConfig.ELEVENLABS_MODEL && effectiveConfig.ELEVENLABS_MODEL !== 'eleven_multilingual_v2') {
      const retryBuffer = await generateElevenLabsAudio({
        text,
        speaker,
        config: { ...effectiveConfig, ELEVENLABS_MODEL: 'eleven_multilingual_v2' },
        signal,
      });
      return Buffer.from(retryBuffer);
    }
    throw err;
  }
}

export async function generateDirectElevenLabsStoryAudio({ content, config = {}, signal }) {
  if (isBengaliStoryContent(content)) {
    throw new ElevenLabsApiError(503, 'english_only_policy');
  }
  const effectiveConfig = withDefaultNarrationVoices(config);
  const segments = parseNarrationSegments(content);
  if (!segments.length) {
    throw new Error('The story does not contain any narration segments.');
  }
  try {
    const audio = await generateElevenLabsDialogue({
      segments,
      config: effectiveConfig,
      signal,
    });
    return Buffer.from(await audio);
  } catch {
    const buffers = [];
    for (const seg of segments) {
      const buf = await generateDirectElevenLabsSpeech({
        text: seg.text,
        speaker: seg.speaker,
        config: { ...effectiveConfig, ELEVENLABS_MODEL: 'eleven_multilingual_v2' },
        signal,
      });
      buffers.push(buf);
    }
    return Buffer.concat(buffers);
  }
}

export async function generateAndUploadLessonAudio({ lesson, config, signal }) {
  if (isBengaliStoryContent(lesson?.content)) {
    throw new ElevenLabsApiError(503, 'english_only_policy');
  }
  if (!config?.ELEVENLABS_API_KEY || !hasCompleteNarrationVoiceConfig(config) || !config?.CLOUDINARY_CLOUD_NAME || !config?.CLOUDINARY_API_KEY || !config?.CLOUDINARY_API_SECRET) {
    throw new Error('ElevenLabs, all four narration voices, and Cloudinary must be configured to generate lesson narration.');
  }

  const voiceConfigVersion = getNarrationVoiceConfigVersion(config);
  const contentHash = crypto.createHash('sha256').update(`${voiceConfigVersion}\n${lesson.content}`).digest('hex').slice(0, 20);
  const publicId = `${lesson.slug || 'daily-lesson'}-${contentHash}`;
  const folder = 'smart-routine/daily-lessons';
  const cloudinaryPublicId = `${folder}/${publicId}`;
  const existing = await cloudinary().client.resourceInfo(cloudinaryPublicId, 'video');
  if (existing?.secure_url) {
    return {
      status: 'ready',
      url: existing.secure_url,
      publicId: existing.public_id || cloudinaryPublicId,
      durationSeconds: existing.duration || null,
      voiceConfigVersion,
      createdAt: existing.created_at ? new Date(existing.created_at) : new Date(),
      updatedAt: new Date(),
      error: null,
    };
  }

  const generated = await generateNarrationAudio({ lesson, config, signal });
  if (!generated?.audioBuffer?.length) {
    throw new Error('ElevenLabs returned an empty narration audio file.');
  }

  const result = await uploadBufferToCloudinary({
    config,
    buffer: generated.audioBuffer,
    publicId,
    folder,
    resourceType: 'video',
    format: 'mp3',
  });

  if (!result?.secure_url) {
    throw new Error('Cloudinary did not return a secure narration URL.');
  }

  return {
    status: 'ready',
    url: result.secure_url,
    publicId: result.public_id || cloudinaryPublicId,
    durationSeconds: result.duration || null,
    voiceConfigVersion,
    createdAt: new Date(),
    updatedAt: new Date(),
    error: null,
  };
}

const audioDramaRequests = new Map();

async function createAudioDramaAsset({ content, config, signal }) {
  if (isBengaliStoryContent(content)) {
    throw new ElevenLabsApiError(503, 'english_only_policy');
  }
  if (!hasCompleteNarrationVoiceConfig(config) || !config?.CLOUDINARY_CLOUD_NAME || !config?.CLOUDINARY_API_KEY || !config?.CLOUDINARY_API_SECRET) {
    throw new Error('All four narration voices and Cloudinary must be configured to save audio dramas.');
  }

  const voiceConfigVersion = getNarrationVoiceConfigVersion(config);
  const contentHash = crypto.createHash('sha256').update(`${voiceConfigVersion}\n${content}`).digest('hex').slice(0, 24);
  const folder = 'smart-routine/audio-dramas';
  const publicId = `drama-${contentHash}`;
  const existingManifest = (await cloudinary().client.resourceInfo(`${folder}/${publicId}.json`, 'raw'))
    || (await cloudinary().client.resourceInfo(`${folder}/${publicId}`, 'raw'));
  if (existingManifest?.secure_url) {
    const response = await fetch(existingManifest.secure_url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('The saved story audio manifest could not be loaded from Cloudinary.');
    const manifest = await response.json();
    if (manifest?.version === NARRATION_AUDIO_VERSION && Array.isArray(manifest.segments) && manifest.segments.length) {
      return { segments: manifest.segments, cached: true };
    }
  }

  if (!config.ELEVENLABS_API_KEY) {
    throw new ElevenLabsApiError(503, 'api_key_not_configured');
  }

  const sentences = parseNarrationSegments(content).flatMap((segment) =>
    splitNarrationSentences(segment.text).map((text) => ({ ...segment, text })),
  );
  if (!sentences.length) throw new Error('The audio drama does not contain any narration segments.');

  const timedSegments = [];
  for (const [index, segment] of sentences.entries()) {
    let generated;
    try {
      generated = await generateElevenLabsAudioWithTimestamps({
        text: segment.text,
        speaker: segment.speaker,
        config,
        signal,
      });
    } catch (err) {
      const model = config.ELEVENLABS_MODEL || 'eleven_v3';
      const retryWithTurbo = model === 'eleven_v3'
        && err?.name !== 'AbortError'
        && !(err instanceof ElevenLabsApiError && [402, 429].includes(err.status));
      if (retryWithTurbo) {
        generated = await generateElevenLabsAudioWithTimestamps({
          text: segment.text,
          speaker: segment.speaker,
          config: { ...config, ELEVENLABS_MODEL: 'eleven_turbo_v2_5' },
          signal,
        });
      } else {
        throw err;
      }
    }
    const words = wordTimingsFromAlignment(segment.text, generated.alignment);
    if (!words.length) throw new Error(`ElevenLabs returned no word timings for story sentence ${index + 1}.`);
    const segmentPublicId = `${publicId}-sentence-${index + 1}`;
    const uploaded = await uploadBufferToCloudinary({
      config,
      buffer: generated.audioBuffer,
      publicId: segmentPublicId,
      folder,
      resourceType: 'video',
      format: 'mp3',
    });
    if (!uploaded?.secure_url) {
      throw new Error(`Cloudinary did not return a secure URL for story sentence ${index + 1}.`);
    }
    timedSegments.push({
      speaker: segment.speaker,
      character: segment.character,
      text: segment.text,
      url: uploaded.secure_url,
      durationSeconds: Math.max(0, ...generated.alignment.character_end_times_seconds.filter(Number.isFinite)),
      words,
    });
  }

  const uploadedManifest = await uploadBufferToCloudinary({
    config,
    buffer: Buffer.from(JSON.stringify({ version: NARRATION_AUDIO_VERSION, segments: timedSegments })),
    publicId,
    folder,
    resourceType: 'raw',
    format: 'json',
  });
  if (!uploadedManifest?.secure_url) throw new Error('Cloudinary did not return a secure story audio manifest URL.');

  return { segments: timedSegments, cached: false };
}

export async function generateAndUploadAudioDrama({ content, config, signal }) {
  if (isBengaliStoryContent(content)) {
    throw new ElevenLabsApiError(503, 'english_only_policy');
  }
  const key = crypto.createHash('sha256')
    .update(`${getNarrationVoiceConfigVersion(config)}\n${content}`)
    .digest('hex');
  const inFlight = audioDramaRequests.get(key);
  if (inFlight) return inFlight;

  const request = createAudioDramaAsset({ content, config, signal });
  audioDramaRequests.set(key, request);
  try {
    return await request;
  } finally {
    audioDramaRequests.delete(key);
  }
}
