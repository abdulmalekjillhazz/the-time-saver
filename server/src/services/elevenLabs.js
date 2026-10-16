import crypto from 'node:crypto';
import { cloudinary, uploadBufferToCloudinary } from './cloudinary.js';

export const ELEVEN_LABS_BASE_URL = 'https://api.elevenlabs.io/v1';

export class ElevenLabsApiError extends Error {
  constructor(status, code) {
    super(`ElevenLabs request failed (${status}, ${code || 'unknown'}).`);
    this.name = 'ElevenLabsApiError';
    this.status = status;
    this.upstreamCode = code || 'unknown';
  }
}

const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};

export const NARRATION_AUDIO_VERSION = 'multi-voice-dialogue-v1';

function normalizeNarrationSpeakerName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s*[-–—:]\s*/g, ' ')
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

export function parseNarrationSpeakerName(value) {
  const normalized = normalizeNarrationSpeakerName(value);
  if (!normalized) return 'narrator';

  if (/\b(?:father|dad|papa|adult male|male|rahim|rahi|baba|babai|vaiya|man)\b/.test(normalized)) return 'father';
  if (/\b(?:mother|mom|mama|adult female|female|asha|aasha|ma|maa|apu|woman|daughter)\b/.test(normalized)) return 'mother';
  if (/\b(?:son|child|kid|boy|rafi|rahi|shishu|bachcha|chele|boy)\b/.test(normalized)) return 'son';
  if (/\b(?:storyteller|story teller|narrator|narration|speaker|voice)\b/.test(normalized) || /গল্পকথক|কথক/.test(normalized)) return 'storyteller';
  return 'narrator';
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

  return voiceIdMap[resolvedSpeaker] || voiceIdMap[normalizeNarrationSpeakerName(speaker)] || null;
}

export function parseNarrationSegments(content = '', defaultSpeaker = 'narrator') {
  if (typeof content !== 'string' || !content.trim()) return [];

  const segments = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^\[([^\]]+)\]\s*:?(.*)$/);
    const speakerMeta = match ? match[1].trim() : null;
    const textValue = match ? match[2].trim() : trimmed;
    const speakerName = speakerMeta ? parseNarrationSpeakerName(speakerMeta) : defaultSpeaker;
    const text = textValue.trim();
    if (!text) continue;

    const speaker = speakerMeta ? speakerName : defaultSpeaker;
    segments.push({ speaker, text, rawLine: trimmed });
  }

  if (segments.length && !segments.some(({ speaker }) => speaker === 'storyteller')) {
    const isBengali = /[\u0980-\u09ff]/.test(content);
    const narrator = (text) => ({ speaker: 'storyteller', text, rawLine: text });
    const middleIndex = Math.max(1, Math.ceil(segments.length / 2));
    segments.splice(middleIndex, 0, narrator(
      isBengali ? 'এরপর তারা একসঙ্গে সমাধান খুঁজতে থাকে।' : 'The family talks it through together.'
    ));
    segments.unshift(narrator(isBengali ? 'গল্পটি শুরু হচ্ছে।' : 'The story begins.'));
    segments.push(narrator(isBengali ? 'এই ছিল আজকের গল্প।' : 'That is the end of the story.'));
  }
  return segments;
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

export async function generateElevenLabsAudio({ text, speaker, config, signal }) {
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

export async function generateAndUploadLessonAudio({ lesson, config, signal }) {
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
  if (!hasCompleteNarrationVoiceConfig(config) || !config?.CLOUDINARY_CLOUD_NAME || !config?.CLOUDINARY_API_KEY || !config?.CLOUDINARY_API_SECRET) {
    throw new Error('All four narration voices and Cloudinary must be configured to save audio dramas.');
  }

  const voiceConfigVersion = getNarrationVoiceConfigVersion(config);
  const contentHash = crypto.createHash('sha256').update(`${voiceConfigVersion}\n${content}`).digest('hex').slice(0, 24);
  const folder = 'smart-routine/audio-dramas';
  const publicId = `drama-${contentHash}`;
  const fullPublicId = `${folder}/${publicId}`;
  const segments = parseNarrationSegments(content);
  if (!segments.length) throw new Error('The audio drama does not contain any narration segments.');

  const existingFull = await cloudinary().client.resourceInfo(fullPublicId, 'video');
  if (existingFull?.secure_url) {
    return {
      url: existingFull.secure_url,
      cached: true,
    };
  }

  if (!config.ELEVENLABS_API_KEY) {
    throw new ElevenLabsApiError(503, 'api_key_not_configured');
  }

  const generated = await generateNarrationAudio({ lesson: { content }, config, signal });
  if (!generated.audioBuffer.length || generated.count !== segments.length) {
    throw new Error('ElevenLabs returned an incomplete story narration.');
  }

  const uploadedFull = await uploadBufferToCloudinary({
    config,
    buffer: generated.audioBuffer,
    publicId,
    folder,
    resourceType: 'video',
    format: 'mp3',
  });
  if (!uploadedFull?.secure_url) throw new Error('Cloudinary did not return a secure full audio drama URL.');

  return { url: uploadedFull.secure_url, cached: false };
}

export async function generateAndUploadAudioDrama({ content, config, signal }) {
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
