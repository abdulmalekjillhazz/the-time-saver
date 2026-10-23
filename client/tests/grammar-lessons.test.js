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
    expect(getGrammarLevelAvailability({ basic: 4, intermediate: 1, advanced: 0 })
      .map(({ id, unlocked }) => [id, unlocked]))
      .toEqual([['basic', true], ['intermediate', true], ['advanced', false]]);
    expect(getGrammarLevelAvailability({ basic: 4, intermediate: 4, advanced: 0 })
      .map(({ id, unlocked }) => [id, unlocked]))
      .toEqual([['basic', true], ['intermediate', true], ['advanced', true]]);
  });

  it('provides progressively harder lessons with English examples and practice', () => {
    expect(GRAMMAR_LEVELS.map(({ lessons }) => lessons.length)).toEqual([4, 4, 4]);
    expect(GRAMMAR_LEVELS.flatMap(({ lessons }) => lessons).every((lesson) => (
      lesson.rule.en && lesson.rule.bn && lesson.example && lesson.choices.length > 1
    ))).toBe(true);
  });

  it('points each exercise to its grammatical and contextually correct answer', () => {
    const lessons = GRAMMAR_LEVELS.flatMap(({ lessons: levelLessons }) => levelLessons);
    const expectedAnswers = {
      'word-order': 'Mina reads a book every evening.',
      'be-verbs': 'They are ready for class.',
      'present-simple': 'She walks to school every day.',
      'past-simple': 'We visited our friend yesterday.',
      'present-continuous': 'The children are playing in the garden now.',
      'joining-ideas': 'I took a break because I felt tired.',
      'do-questions': 'Does Maya walk to class every day?',
      'there-is-are': 'There are two chairs near the window.',
      'going-to-plans': 'We are going to visit the museum tomorrow.',
      'some-any': 'Could I have some water, please?',
      'first-conditional': 'If we leave now, we will catch the earlier bus.',
      'present-perfect-experience': 'I have visited the new science museum.',
    };
    for (const lesson of lessons) {
      expect(lesson.choices[lesson.answer], lesson.id).toBe(expectedAnswers[lesson.id]);
      expect(lesson.choices.every((choice) => /[.!?]$/.test(choice))).toBe(true);
    }
  });

  it('uses complete, grammatically correct sentences in every answer choice', () => {
    const lessons = GRAMMAR_LEVELS.flatMap(({ lessons: levelLessons }) => levelLessons);
    for (const lesson of lessons) {
      expect(lesson.answer).toBeGreaterThanOrEqual(0);
      expect(lesson.answer).toBeLessThan(lesson.choices.length);
      expect(lesson.choices[lesson.answer]).toMatch(/[.!?]$/);
      expect(lesson.choices.every((choice) => /[.!?]$/.test(choice))).toBe(true);
      expect(lesson.choices).not.toContain('She walk to school every day.');
      expect(lesson.choices).not.toContain('We are visit our friend yesterday.');
    }
    expect(lessons.find(({ id }) => id === 'be-verbs').choices[1]).toBe('They are ready for class.');
    expect(lessons.find(({ id }) => id === 'present-simple').choices[0]).toBe('She walks to school every day.');
  });

  it('renders a bilingual lesson with a natural-voice listen control', () => {
    const markup = renderToStaticMarkup(createElement(GrammarLessons, {
      lang: 'bn',
      stories: [{ slug: 'short-story', title: 'A Short Story', body: 'Mina reads a book.' }],
    }));

    expect(markup).toContain('Building — ইংরেজি বাক্য অনুশীলন');
    expect(markup).toContain('grammar-lessons-section');
    expect(markup).toContain('স্বাভাবিক কণ্ঠে শুনুন');
    expect(markup).toContain('Mina reads a book every evening.');
    expect(markup).toContain('গল্প থেকে বাক্য সাজানোর অনুশীলন');
    expect(markup).toContain('১০টি বাক্যে ৩০ পয়েন্ট');
    expect(markup).toContain('বাক্য যাচাই');
  });
});
