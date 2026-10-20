export const MAX_SPEECH_PRACTICE_ATTEMPTS = 3;

export function canAttemptSpeechPractice(attemptCount) {
  return Number.isInteger(attemptCount)
    && attemptCount >= 0
    && attemptCount < MAX_SPEECH_PRACTICE_ATTEMPTS;
}

export function speechWords(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) || [];
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
      const substitutionCost = targetWords[i - 1] === spokenWords[j - 1] ? 0 : 1;
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
    if (i > 0 && j > 0 && targetWords[i - 1] === spokenWords[j - 1]
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

  return { accuracy, targetWords, matchedWords };
}
