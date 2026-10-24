const MAX_NARRATION_SEGMENT_CHARS = 150;

function normalizeSpeakerName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s*[-–—:]\s*/g, ' ')
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseNarrationSpeakerName(value) {
  const normalized = normalizeSpeakerName(value);
  if (!normalized) return 'narrator';

  if (/\b(?:father|dad|papa|adult male|male|rahim|rahi|baba|babai|vaiya|man)\b/.test(normalized)) return 'father';
  if (/\b(?:mother|mom|mama|adult female|female|asha|aasha|ma|maa|apu|woman|daughter)\b/.test(normalized)) return 'mother';
  if (/\b(?:son|child|kid|boy|rafi|rahi|shishu|bachcha|chele)\b/.test(normalized)) return 'son';
  if (/\b(?:storyteller|story teller|narrator|narration|speaker|voice)\b/.test(normalized) || /গল্পকথক|কথক|বর্ণনাকারী/.test(normalized)) return 'storyteller';
  return 'narrator';
}

function splitNarrationText(text) {
  const chunks = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= MAX_NARRATION_SEGMENT_CHARS) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = word;
    while (current.length > MAX_NARRATION_SEGMENT_CHARS) {
      chunks.push(current.slice(0, MAX_NARRATION_SEGMENT_CHARS));
      current = current.slice(MAX_NARRATION_SEGMENT_CHARS);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function parseSpeakerTag(line) {
  const bracketMatch = line.match(/^\[([^\]]+)\]\s*:?\s*(.*)$/);
  if (bracketMatch) {
    return {
      character: bracketMatch[1].trim(),
      text: bracketMatch[2].trim(),
    };
  }

  const plainMatch = line.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\u0980-\u09FF][\w\s'’.-]*?)\s*:\s*(.+)$/);
  if (plainMatch && parseNarrationSpeakerName(plainMatch[1]) !== 'narrator') {
    return {
      character: plainMatch[1].trim(),
      text: plainMatch[2].trim(),
    };
  }

  return null;
}

export function parseStoryNarration(content = '', defaultSpeaker = 'Narrator') {
  if (typeof content !== 'string' || !content.trim()) return [];

  const segments = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const tag = parseSpeakerTag(line);
    const character = tag?.character || defaultSpeaker;
    const text = tag ? tag.text : line;
    if (!text) continue;

    const speaker = tag
      ? parseNarrationSpeakerName(character)
      : parseNarrationSpeakerName(defaultSpeaker);
    for (const chunk of splitNarrationText(text)) {
      segments.push({ speaker, character, text: chunk });
    }
  }

  if (segments.length && !segments.some(({ speaker }) => speaker === 'storyteller')) {
    const isBengali = /[\u0980-\u09ff]/.test(content);
    const narrator = (text) => ({
      speaker: 'storyteller',
      character: isBengali ? 'গল্পকথক' : 'Storyteller',
      text,
    });
    const middleIndex = Math.max(1, Math.ceil(segments.length / 2));
    segments.splice(middleIndex, 0, narrator(
      isBengali ? 'এরপর তারা একসঙ্গে সমাধান খুঁজতে থাকে।' : 'The family talks it through together.',
    ));
    segments.unshift(narrator(isBengali ? 'গল্পটি শুরু হচ্ছে।' : 'The story begins.'));
    segments.push(narrator(isBengali ? 'এই ছিল আজকের গল্প।' : 'That is the end of the story.'));
  }

  return segments;
}
