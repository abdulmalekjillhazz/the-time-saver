const ENGLISH_WORD = /[A-Za-z]+(?:['’][A-Za-z]+)?/g;
const SENTENCE_PREFIX = 'sentence:';

export function getSentenceDifficultyLevel(sentence) {
  const wordCount = typeof sentence === 'number'
    ? sentence
    : (String(sentence).match(ENGLISH_WORD) || []).length;

  if (wordCount <= 5) return 'basic';
  if (wordCount <= 9) return 'intermediate';
  return 'advanced';
}

export function summarizeGrammarSentenceProgress(contentIds) {
  const sentenceIds = contentIds.filter(
    (contentId) => typeof contentId === 'string' && contentId.startsWith(SENTENCE_PREFIX),
  );
  const completedLevels = { basic: 0, intermediate: 0, advanced: 0 };

  for (const contentId of sentenceIds) {
    const separator = contentId.indexOf(':', SENTENCE_PREFIX.length);
    if (separator < 0) continue;
    const sentence = contentId.slice(separator + 1);
    if (!sentence) continue;
    completedLevels[getSentenceDifficultyLevel(sentence)] += 1;
  }

  return { completedSentences: sentenceIds.length, completedLevels };
}
