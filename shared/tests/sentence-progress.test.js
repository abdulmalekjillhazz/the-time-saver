import { describe, expect, it } from 'vitest';
import {
  getSentenceDifficultyLevel,
  summarizeGrammarSentenceProgress,
} from '../src/sentenceProgress.js';

describe('grammar sentence progress', () => {
  it('classifies sentence difficulty by English word count', () => {
    expect(getSentenceDifficultyLevel('Mina reads every day.')).toBe('basic');
    expect(getSentenceDifficultyLevel('Mina reads a useful book every day.')).toBe('intermediate');
    expect(getSentenceDifficultyLevel('Mina reads a useful book every day because she enjoys learning.')).toBe('advanced');
  });

  it('summarizes saved sentence completions by difficulty and ignores other activities', () => {
    expect(summarizeGrammarSentenceProgress([
      'sentence:morning-walk:mina reads every day.',
      'sentence:morning-walk:mina reads a useful book every day.',
      'sentence:brain-breaks:mina reads a useful book every day because she enjoys learning.',
      'milestone:ten-sentences',
      'sentence:missing-separator',
    ])).toEqual({
      completedSentences: 4,
      completedLevels: { basic: 1, intermediate: 1, advanced: 1 },
    });
  });
});
