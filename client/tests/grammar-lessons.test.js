import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getGrammarLevelAvailability,
  GRAMMAR_LEVELS,
  GrammarLessons,
} from '../components/GrammarLessons.jsx';

describe('progressive grammar lessons', () => {
  it('starts with Basic and unlocks harder levels after finishing the prior lessons', () => {
    expect(getGrammarLevelAvailability({ basic: 0, intermediate: 0, advanced: 0 })
      .map(({ id, unlocked }) => [id, unlocked]))
      .toEqual([['basic', true], ['intermediate', false], ['advanced', false]]);
    expect(getGrammarLevelAvailability({ basic: 2, intermediate: 1, advanced: 0 })
      .map(({ id, unlocked }) => [id, unlocked]))
      .toEqual([['basic', true], ['intermediate', true], ['advanced', false]]);
    expect(getGrammarLevelAvailability({ basic: 2, intermediate: 2, advanced: 0 })
      .map(({ id, unlocked }) => [id, unlocked]))
      .toEqual([['basic', true], ['intermediate', true], ['advanced', true]]);
  });

  it('provides progressively harder lessons with English examples and practice', () => {
    expect(GRAMMAR_LEVELS.map(({ lessons }) => lessons.length)).toEqual([2, 2, 2]);
    expect(GRAMMAR_LEVELS.flatMap(({ lessons }) => lessons).every((lesson) => (
      lesson.rule.en && lesson.rule.bn && lesson.example && lesson.choices.length > 1
    ))).toBe(true);
  });

  it('renders a bilingual lesson with a natural-voice listen control', () => {
    const markup = renderToStaticMarkup(createElement(GrammarLessons, {
      lang: 'bn',
      stories: [{ slug: 'short-story', title: 'A Short Story', body: 'Mina reads a book.' }],
    }));

    expect(markup).toContain('ইংরেজি Grammar — ধাপে ধাপে');
    expect(markup).toContain('স্বাভাবিক কণ্ঠে শুনুন');
    expect(markup).toContain('Mina reads a book every evening.');
    expect(markup).toContain('গল্প থেকে বাক্য সাজানোর অনুশীলন');
    expect(markup).toContain('বাক্য যাচাই');
  });
});
