import { describe, expect, it } from 'vitest';
import {
  canAttemptSpeechPractice,
  compareSpeechText,
  getConversationPracticeLines,
  getPracticeExpression,
  getNextPracticeLineIndex,
  getSpeechPracticeAccuracy,
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

  it('practices sentences strictly in story order', () => {
    const lines = [
      { text: 'Extraordinary vocabulary challenges learners.' },
      { text: 'We learn.' },
      { text: 'Today we practice speaking.' },
    ];

    expect(getNextPracticeLineIndex(lines)).toBe(0);
    expect(getNextPracticeLineIndex(lines, 0)).toBe(1);
    expect(getNextPracticeLineIndex(lines, 1)).toBe(2);
    expect(getNextPracticeLineIndex(lines, 2)).toBe(-1);
  });

  it('starts at the first character conversation and leaves narrator introductions out', () => {
    const lines = [
      { character: 'Narrator', text: 'The story begins.' },
      { character: 'Scene', text: 'The door opens.' },
      { character: 'Mina', text: 'Where did you put the book?' },
      { character: 'Tariq', text: 'It is on the table.' },
    ];

    expect(getConversationPracticeLines(lines)).toEqual(lines.slice(2));
    expect(getConversationPracticeLines(lines.slice(0, 2))).toEqual(lines.slice(0, 2));
  });

  it('changes the character face to match the line emotion', () => {
    expect(getPracticeExpression('Haha, that was a funny joke!')).toBe('😄');
    expect(getPracticeExpression('I am sad and I miss you.')).toBe('😢');
    expect(getPracticeExpression('Wow, really?')).toBe('😮');
    expect(getPracticeExpression('I feel worried about the problem.')).toBe('😟');
    expect(getPracticeExpression('We can talk about it.')).toBe('🙂');
  });

  it('calculates a word-weighted overall score and counts skipped sentences as missed', () => {
    const lines = [
      { text: 'I like green apples' },
      { text: 'We are ready' },
    ];

    expect(getSpeechPracticeAccuracy(lines, {
      0: compareSpeechText('I like green apples', 'I like red apples'),
    })).toBe(43);
    expect(getSpeechPracticeAccuracy(lines, {
      0: compareSpeechText('I like green apples', 'I like green apples'),
      1: compareSpeechText('We are ready', 'We are ready'),
    })).toBe(100);
  });

  it('normalizes English words and punctuation for comparison', () => {
    expect(speechWords("Hello, world! It's a bright day.")).toEqual([
      'hello', 'world', "it's", 'a', 'bright', 'day',
    ]);
    expect(compareSpeechText('Hello, world!', 'hello world')).toMatchObject({
      accuracy: 100,
      errors: 0,
      targetWords: ['hello', 'world'],
      matchedWords: [true, true],
    });
  });

  it('reports word-level matches and a reduced score for misrecognized words', () => {
    expect(compareSpeechText('I like green apples', 'I like red apples')).toEqual({
      accuracy: 75,
      errors: 1,
      targetWords: ['i', 'like', 'green', 'apples'],
      matchedWords: [true, true, false, true],
    });
  });

  it('counts missing and extra words as recognition errors', () => {
    expect(compareSpeechText('We are ready', 'We really are ready').accuracy).toBe(67);
    expect(compareSpeechText('We are ready', 'We ready').accuracy).toBe(67);
    expect(getSpeechPracticeAccuracy([{ text: 'We are ready' }], {
      0: compareSpeechText('We are ready', 'We really are ready'),
    })).toBe(67);
  });

  it('returns a zero score when the target has no English words', () => {
    expect(compareSpeechText('বাংলা লেখা', 'বাংলা লেখা')).toEqual({
      accuracy: 0,
      errors: 0,
      targetWords: [],
      matchedWords: [],
    });
  });
});
