export const MAX_SPEECH_PRACTICE_ATTEMPTS = 3;
export const MIN_PRONUNCIATION_SCORE_TO_SAVE = 40;

export function getPronunciationFeedbackTier(accuracy) {
  if (accuracy >= 60) return 'great';
  if (accuracy >= 40) return 'good';
  return 'retry';
}

export function shouldSubmitPronunciationScore(accuracy) {
  return accuracy >= MIN_PRONUNCIATION_SCORE_TO_SAVE;
}

function wordLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 1) return 2;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

export function wordsMatch(w1, w2) {
  if (w1 === w2) return true;
  if (!w1 || !w2) return false;
  const s1 = w1.replace(/['’]/g, '');
  const s2 = w2.replace(/['’]/g, '');
  if (s1 === s2) return true;
  if ((s1 === 'ok' && s2 === 'okay') || (s1 === 'okay' && s2 === 'ok')) return true;
  if ((s1 === 'yes' && s2 === 'yeah') || (s1 === 'yeah' && s2 === 'yes')) return true;
  if (Math.min(s1.length, s2.length) >= 4 && wordLevenshtein(s1, s2) <= 1) return true;
  return false;
}

export function canAttemptSpeechPractice(attemptCount) {
  return Number.isInteger(attemptCount)
    && attemptCount >= 0
    && attemptCount < MAX_SPEECH_PRACTICE_ATTEMPTS;
}

export function speechWords(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) || [];
}

export function getNextPracticeLineIndex(lines, currentIndex = -1) {
  const nextIndex = currentIndex + 1;
  return nextIndex < lines.length ? nextIndex : -1;
}

export function getConversationPracticeLines(lines) {
  const firstDialogueIndex = lines.findIndex(({ character }) => (
    !/^(?:narrator|storyteller|story teller|narration|scene|speaker)$/i.test(String(character || '').trim())
  ));
  return firstDialogueIndex < 0 ? lines : lines.slice(firstDialogueIndex);
}

export function getPracticeExpression(text) {
  if (/\b(?:haha|hahaha|lol|laugh|funny|joke|hilarious|amazing|great|wonderful|happy|glad|excited)\b/i.test(text)) {
    return '😄';
  }
  if (/\b(?:sad|sorry|cry|cried|tears|miss you|missed|unhappy|lost)\b/i.test(text)) return '😢';
  if (/\b(?:wow|really|surprised|surprise|unexpected|what\?|no way)\b/i.test(text)) return '😮';
  if (/\b(?:worried|worry|afraid|scared|nervous|anxious|problem|danger)\b/i.test(text)) return '😟';
  if (/\b(?:angry|annoyed|furious|upset|mad)\b/i.test(text)) return '😠';
  return '🙂';
}

export function getSpeechPracticeAccuracy(lines, comparisonsByIndex = {}) {
  let errors = 0;
  let totalWords = 0;

  lines.forEach((line, index) => {
    const targetWordCount = speechWords(line.text).length;
    const comparison = comparisonsByIndex[index];
    const lineErrors = comparison ? comparison.errors : targetWordCount;
    totalWords += targetWordCount;
    errors += Math.min(targetWordCount, lineErrors);
  });

  return totalWords ? Math.round(((totalWords - errors) / totalWords) * 100) : 0;
}

export function compareSpeechText(expected, recognized) {
  const targetWords = speechWords(expected);
  const spokenWords = speechWords(recognized);
  const rows = targetWords.length + 1;
  const columns = spokenWords.length + 1;
  const distance = Array.from({ length: rows }, () => Array(columns).fill(0));

  for (let i = 0; i < rows; i += 1) distance[i][0] = i;
  for (let j = 0; j < columns; j += 1) distance[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      const substitutionCost = wordsMatch(targetWords[i - 1], spokenWords[j - 1]) ? 0 : 1;
      distance[i][j] = Math.min(
        distance[i - 1][j] + 1,
        distance[i][j - 1] + 1,
        distance[i - 1][j - 1] + substitutionCost,
      );
    }
  }

  const matchedWords = Array(targetWords.length).fill(false);
  let i = targetWords.length;
  let j = spokenWords.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsMatch(targetWords[i - 1], spokenWords[j - 1])
      && distance[i][j] === distance[i - 1][j - 1]) {
      matchedWords[i - 1] = true;
      i -= 1;
      j -= 1;
    } else if (i > 0 && j > 0 && distance[i][j] === distance[i - 1][j - 1] + 1) {
      i -= 1;
      j -= 1;
    } else if (i > 0 && distance[i][j] === distance[i - 1][j] + 1) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  const errors = distance[targetWords.length][spokenWords.length];
  const accuracy = targetWords.length
    ? Math.max(0, Math.round(((targetWords.length - errors) / targetWords.length) * 100))
    : 0;

  return { accuracy, errors, targetWords, matchedWords };
}
