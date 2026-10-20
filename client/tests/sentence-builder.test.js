import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  extractGrammarExercises,
  isSentenceCorrect,
  SentenceBuilder,
} from '../components/SentenceBuilder.jsx';

describe('English sentence builder', () => {
  const stories = [
    {
      slug: 'morning-walk',
      title: 'A Morning Walk',
      body: '[Nina]: I take a short walk every morning. Mina rested because her focus became tired.',
      category: 'health',
    },
    {
      slug: 'brain-breaks',
      title: 'Why Breaks Help the Brain',
      body: 'Scientists studied how short breaks changed the way the brain held attention.',
      category: 'science',
    },
  ];

  it('extracts useful sentence-building exercises from story text', () => {
    const exercises = extractGrammarExercises(stories);

    expect(exercises.map(({ sentence, category, sourceTitle }) => ({ sentence, category, sourceTitle }))).toEqual([
      { sentence: 'I take a short walk every morning.', category: 'everyday', sourceTitle: 'A Morning Walk' },
      { sentence: 'Mina rested because her focus became tired.', category: 'explaining', sourceTitle: 'A Morning Walk' },
      { sentence: 'Scientists studied how short breaks changed the way the brain held attention.', category: 'reading', sourceTitle: 'Why Breaks Help the Brain' },
    ]);
    expect(exercises[0].structure.en).toContain('Subject + verb');
  });

  it('checks a complete sentence against its story-derived word order', () => {
    const exercise = extractGrammarExercises(stories)[0];
    const correctOrder = exercise.answer.map((word) => exercise.words.indexOf(word));
    expect(isSentenceCorrect(correctOrder, exercise)).toBe(true);
    expect(isSentenceCorrect([...correctOrder].reverse(), exercise)).toBe(false);
    expect(isSentenceCorrect(correctOrder.slice(1), exercise)).toBe(false);
  });

  it('renders bilingual categories and uses the selected story as the lesson source', () => {
    const markup = renderToStaticMarkup(createElement(SentenceBuilder, { lang: 'bn', stories }));

    expect(markup).toContain('ইংরেজি বাক্য গঠন');
    expect(markup).toContain('গল্প থেকে ইংরেজি বাক্য গঠন শেখো');
    expect(markup).toContain('দৈনন্দিন কথা');
    expect(markup).toContain('ব্যাখ্যা করা');
    expect(markup).toContain('থিসিসের মতো লম্বা লেখা');
    expect(markup).toContain('A Morning Walk');
    expect(markup).toContain('বাক্য যাচাই');
  });
});
