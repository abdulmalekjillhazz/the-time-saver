import { describe, expect, it } from 'vitest';
import {
  canAttemptSpeechPractice,
  compareSpeechText,
  getAdaptivePracticeLineIndex,
  MAX_SPEECH_PRACTICE_ATTEMPTS,
  speechWords,
} from '../lib/speechPractice.js';

describe('story speech practice matching', () => {
  it('allows at most three attempts for each story line', () => {
    expect(MAX_SPEECH_PRACTICE_ATTEMPTS).toBe(3);
    expect([0, 1, 2].every(canAttemptSpeechPractice)).toBe(true);
    expect(canAttemptSpeechPractice(3)).toBe(false);
    expect(canAttemptSpeechPractice(-1)).toBe(false);
  });

  it('starts with the easiest sentence and adapts the next choice to speaking accuracy', () => {
    const lines = [
      { text: 'Extraordinary vocabulary challenges learners.' },
      { text: 'We learn.' },
      { text: 'Today we practice speaking.' },
    ];

    expect(getAdaptivePracticeLineIndex(lines)).toBe(1);
    expect(getAdaptivePracticeLineIndex(lines, [1], 1, 100)).toBe(2);
    expect(getAdaptivePracticeLineIndex(lines, [2], 0, 40)).toBe(1);
    expect(getAdaptivePracticeLineIndex(lines, [0, 1, 2], 2, 100)).toBe(-1);
  });

  it('normalizes English words and punctuation for comparison', () => {
    expect(speechWords("Hello, world! It's a bright day.")).toEqual([
      'hello', 'world', "it's", 'a', 'bright', 'day',
    ]);
    expect(compareSpeechText('Hello, world!', 'hello world')).toMatchObject({
      accuracy: 100,
      targetWords: ['hello', 'world'],
      matchedWords: [true, true],
    });
  });

  it('reports word-level matches and a reduced score for misrecognized words', () => {
    expect(compareSpeechText('I like green apples', 'I like red apples')).toEqual({
      accuracy: 75,
      targetWords: ['i', 'like', 'green', 'apples'],
      matchedWords: [true, true, false, true],
    });
  });

  it('counts missing and extra words as recognition errors', () => {
    expect(compareSpeechText('We are ready', 'We really are ready').accuracy).toBe(67);
    expect(compareSpeechText('We are ready', 'We ready').accuracy).toBe(67);
  });

  it('returns a zero score when the target has no English words', () => {
    expect(compareSpeechText('বাংলা লেখা', 'বাংলা লেখা')).toEqual({
      accuracy: 0,
      targetWords: [],
      matchedWords: [],
    });
  });
});
