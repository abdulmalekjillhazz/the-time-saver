import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  extractGrammarExercises,
  createCoreSentenceExercises,
  getUnlockedLevels,
  isSentenceCorrect,
  shuffleItems,
  shuffleSentenceWords,
  SentenceBuilder,
} from '../components/SentenceBuilder.jsx';

describe('English sentence builder', () => {
  const stories = [
    {
      slug: 'morning-walk',
      title: 'A Morning Walk',
      body: '[Nina]: Mina walks to school. I take a short walk every morning. Mina rested because her focus became tired.',
      category: 'health',
    },
    {
      slug: 'brain-breaks',
      title: 'Why Breaks Help the Brain',
      body: 'Scientists studied how short breaks changed the way the brain held attention.',
      category: 'science',
    },
  ];

  it('extracts story sentences and assigns difficulty by sentence length', () => {
    const exercises = extractGrammarExercises(stories);

    expect(exercises.map(({ sentence, level, sourceTitle }) => ({ sentence, level, sourceTitle }))).toEqual([
      { sentence: 'Mina walks to school.', level: 'basic', sourceTitle: 'A Morning Walk' },
      { sentence: 'I take a short walk every morning.', level: 'intermediate', sourceTitle: 'A Morning Walk' },
      { sentence: 'Mina rested because her focus became tired.', level: 'intermediate', sourceTitle: 'A Morning Walk' },
      { sentence: 'Scientists studied how short breaks changed the way the brain held attention.', level: 'advanced', sourceTitle: 'Why Breaks Help the Brain' },
    ]);
    expect(exercises[0].structure.en).toContain('Subject + verb');
  });

  it('keeps a substantial original practice bank at every level', () => {
    const exercises = createCoreSentenceExercises();

    expect(exercises).toHaveLength(24);
    expect(exercises.filter(({ level }) => level === 'basic')).toHaveLength(8);
    expect(exercises.filter(({ level }) => level === 'intermediate')).toHaveLength(8);
    expect(exercises.filter(({ level }) => level === 'advanced')).toHaveLength(8);
    expect(new Set(exercises.map(({ sentence }) => sentence.toLowerCase())).size).toBe(24);
  });

  it('unlocks harder levels only after completing the current level', () => {
    const counts = { basic: 4, intermediate: 2, advanced: 1 };
    expect(getUnlockedLevels(counts, { basic: 0, intermediate: 0, advanced: 0 }))
      .toEqual(['basic']);
    expect(getUnlockedLevels(counts, { basic: 3, intermediate: 0, advanced: 0 }))
      .toEqual(['basic', 'intermediate']);
    expect(getUnlockedLevels(counts, { basic: 3, intermediate: 2, advanced: 0 }))
      .toEqual(['basic', 'intermediate', 'advanced']);
  });

  it('skips levels that have no story-derived sentences', () => {
    expect(getUnlockedLevels({ basic: 0, intermediate: 0, advanced: 2 }, { basic: 0, intermediate: 0, advanced: 0 }))
      .toEqual(['basic', 'intermediate', 'advanced']);
  });

  it('checks a complete sentence against its story-derived word order', () => {
    const exercise = extractGrammarExercises(stories)[0];
    const correctOrder = exercise.answer.map((word) => exercise.words.indexOf(word));
    expect(isSentenceCorrect(correctOrder, exercise)).toBe(true);
    expect(isSentenceCorrect([...correctOrder].reverse(), exercise)).toBe(false);
    expect(isSentenceCorrect(correctOrder.slice(1), exercise)).toBe(false);
  });

  it('randomizes words and sentence sources instead of reversing the answer', () => {
    const answer = ['The', 'family', 'talks', 'together.'];
    expect(shuffleSentenceWords(answer, () => 0)).not.toEqual(answer);
    expect(shuffleSentenceWords(answer, () => 0).sort()).toEqual([...answer].sort());

    const sourceSentences = extractGrammarExercises(stories);
    const randomized = shuffleItems(sourceSentences, () => 0);
    expect(randomized.map((item) => item.slug)).not.toEqual(sourceSentences.map((item) => item.slug));
    expect(randomized).toHaveLength(sourceSentences.length);
  });

  it('starts with Basic and uses the selected story as the lesson source', () => {
    const markup = renderToStaticMarkup(createElement(SentenceBuilder, { lang: 'bn', stories }));

    expect(markup).toContain('ইংরেজি বাক্য গঠন');
    expect(markup).toContain('সহজ থেকে ধাপে ধাপে ইংরেজি বাক্য গঠন');
    expect(markup).toContain('শুরু · ছোট বাক্য');
    expect(markup).toContain('মাঝারি · একটু বড় বাক্য');
    expect(markup).toContain('উন্নত · লম্বা বাক্য');
    expect(markup).toContain('A Morning Walk');
    expect(markup).toContain('value="all"');
    expect(markup).toContain('Why Breaks Help the Brain');
    expect(markup).toContain('শব্দের উচ্চারণ শুনুন');
    expect(markup).toContain('বাক্য যাচাই');
    expect(markup).toContain('অনুশীলন 1 / 9');
    expect(markup).toContain('Everyday sentence practice');
    expect(markup).toContain('আগের স্তর:');
  });
});
