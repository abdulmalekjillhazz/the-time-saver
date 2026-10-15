const GOOGLE_TRANSLATE_TTS_ENDPOINT = 'https://translate.google.com/translate_tts';
const MAX_CHUNK_CODE_POINTS = 180;
const UPSTREAM_TIMEOUT_MS = 15_000;

export class GoogleTtsApiError extends Error {
  constructor(status, code) {
    super(`Free Google Translate TTS request failed (${status}, ${code || 'unknown'}).`);
    this.name = 'GoogleTtsApiError';
    this.status = status;
    this.upstreamCode = code || 'unknown';
  }
}

export function splitGoogleTtsText(text, maxCodePoints = MAX_CHUNK_CODE_POINTS) {
  const characters = [...String(text ?? '').trim()];
  if (!characters.length || !Number.isInteger(maxCodePoints) || maxCodePoints < 1) return [];

  const chunks = [];
  while (characters.length) {
    let boundary = Math.min(maxCodePoints, characters.length);
    if (boundary < characters.length) {
      for (let index = boundary - 1; index >= Math.floor(maxCodePoints / 2); index -= 1) {
        if (/[.!?।,;:\s]/u.test(characters[index])) {
          boundary = index + 1;
          break;
        }
      }
    }
    const chunk = characters.splice(0, boundary).join('').trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

export function buildGoogleTtsRequest({ text, lang }) {
  const chunk = typeof text === 'string' ? text.trim() : '';
  if (!chunk || [...chunk].length > MAX_CHUNK_CODE_POINTS) {
    throw new Error(`Text-to-speech chunks must contain 1 to ${MAX_CHUNK_CODE_POINTS} characters.`);
  }
  if (!['bn', 'en'].includes(lang)) {
    throw new Error('A supported Google TTS language is required.');
  }

  const url = new URL(GOOGLE_TRANSLATE_TTS_ENDPOINT);
  url.search = new URLSearchParams({
    ie: 'UTF-8',
    client: 'tw-ob',
    tl: lang,
    q: chunk,
  }).toString();
  return {
    method: 'GET',
    url: url.toString(),
    headers: {
      Accept: 'audio/mpeg',
      'User-Agent': 'Mozilla/5.0',
    },
  };
}

export async function generateGoogleTtsAudio({ text, lang, signal }) {
  const chunks = splitGoogleTtsText(text);
  if (!chunks.length) throw new Error('Text-to-speech input must not be empty.');

  const audioChunks = [];
  for (const chunk of chunks) {
    const request = buildGoogleTtsRequest({ text: chunk, lang });
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      signal: signal || AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new GoogleTtsApiError(response.status, 'upstream_unavailable');
    }

    const contentType = response.headers.get('content-type') || '';
    const audio = Buffer.from(await response.arrayBuffer());
    if (!contentType.toLowerCase().includes('audio/') || audio.length < 4) {
      throw new GoogleTtsApiError(response.status, 'invalid_audio_response');
    }
    audioChunks.push(audio);
  }

  return Buffer.concat(audioChunks);
}
