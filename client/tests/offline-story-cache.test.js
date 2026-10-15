import { describe, expect, it } from 'vitest';
import { extractUniqueEnglishWords } from '../lib/offlineStoryCache.js';

describe('offline story word extraction', () => {
  it('returns every unique word once without case or possessive duplicates', () => {
    expect(extractUniqueEnglishWords("Mina's dog, DOG! RUNS.")).toEqual([
      'mina',
      'dog',
      'runs',
    ]);
  });

  it('extracts words from line arrays and localized story objects', () => {
    expect(extractUniqueEnglishWords([
      { text: 'A curious fox jumps.' },
      { text: 'The fox laughs!' },
    ])).toEqual(['a', 'curious', 'fox', 'jumps', 'the', 'laughs']);
    expect(extractUniqueEnglishWords({ en: 'A tiny robot dances.', bn: 'একটি ছোট রোবট নাচে।' }))
      .toEqual(['a', 'tiny', 'robot', 'dances']);
  });
});
