import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DailyLessonCard } from '../components/DailyLessonCard.jsx';

const lesson = {
  title: 'The Missing Lunchbox',
  description: 'A funny family story about making a small plan.',
  date: '2026-10-16',
  content: '[Storyteller]: The lunchbox was missing.\n[Rafi - Child]: I put it beside my shoes.',
  vocabulary: [],
};

describe('daily lesson card', () => {
  it('keeps the full story and quiz hidden until a collapsible lesson is opened', () => {
    const markup = renderToStaticMarkup(createElement(DailyLessonCard, {
      dailyLesson: lesson,
      quiz: { questions: [] },
      lang: 'en',
      collapsible: true,
    }));

    expect(markup).toContain('The Missing Lunchbox');
    expect(markup).toContain('Open story and quiz');
    expect(markup).not.toContain('The lunchbox was missing.');
    expect(markup).not.toContain('Learn English by Story');
  });

  it('keeps the full story visible by default for public lesson pages', () => {
    const markup = renderToStaticMarkup(createElement(DailyLessonCard, {
      dailyLesson: lesson,
      quiz: null,
      lang: 'en',
    }));

    expect(markup).toContain('The lunchbox was missing.');
    expect(markup).toContain('Learn English by Story');
  });
});
