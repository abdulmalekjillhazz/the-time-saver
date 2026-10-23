import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpeakingSituations } from '../components/SpeakingSituations.jsx';
import { SPEAKING_SITUATIONS } from '../lib/speakingSituations.js';
import { parseStoryScript } from '../lib/audioDrama.js';

describe('situation-based English speaking practice', () => {
  it('offers a broad set of everyday conversation contexts', () => {
    expect(SPEAKING_SITUATIONS).toHaveLength(16);
    expect(SPEAKING_SITUATIONS.map(({ id }) => id)).toEqual([
      'cafe',
      'introductions',
      'shopping',
      'directions',
      'bus',
      'hotel',
      'doctor',
      'interview',
      'grocery',
      'airport',
      'work-small-talk',
      'phone-appointment',
      'returning-item',
      'library',
      'renting-room',
      'community-event',
    ]);
  });

  it('provides a complete English dialogue for every situation', () => {
    for (const situation of SPEAKING_SITUATIONS) {
      const lines = parseStoryScript(situation.dialogue, 'Narrator');

      expect(lines.length, situation.id).toBeGreaterThanOrEqual(10);
      expect(lines.every((line) => line.text.trim().length > 0), situation.id).toBe(true);
      expect(situation.title.en).toBeTruthy();
      expect(situation.title.bn).toBeTruthy();
      expect(situation.description.en).toBeTruthy();
      expect(situation.description.bn).toBeTruthy();
    }
  });

  it('renders situation names, icons, context, and a tappable conversation', () => {
    const markup = renderToStaticMarkup(createElement(SpeakingSituations, { lang: 'en' }));

    for (const situation of SPEAKING_SITUATIONS) {
      expect(markup).toContain(situation.title.en);
      expect(markup).toContain(situation.icon);
      expect(markup).toContain(situation.description.en);
    }
    expect(markup).toContain('16 situations');
    expect(markup).toContain('At a café');
    expect(markup).toContain('Could I have a cup of tea, please?');
    expect(markup).toContain('role="button"');
    expect(markup).toContain('aria-pressed="true"');
  });

  it('localizes situation labels for Bengali learners while keeping English dialogue', () => {
    const markup = renderToStaticMarkup(createElement(SpeakingSituations, { lang: 'bn' }));

    expect(markup).toContain('পরিস্থিতি অনুযায়ী ইংরেজিতে কথা বলুন');
    expect(markup).toContain('ক্যাফেতে অর্ডার');
    expect(markup).toContain('Good morning. Could I have a cup of tea, please?');
  });

  it('adds the generated daily story as a speaking lesson without replacing existing situations', () => {
    const markup = renderToStaticMarkup(createElement(SpeakingSituations, {
      lang: 'en',
      dailyLesson: {
        date: '2026-10-23',
        title: 'The Helpful Neighbors',
        content: '[Nora - Neighbor]: Good morning.\n[Storyteller]: The day began with a smile.',
      },
    }));

    expect(markup).toContain('17 situations');
    expect(markup).toContain('The Helpful Neighbors');
    expect(markup).toContain('>Start</button>');
    expect(markup).not.toContain('Fresh story sentences');
    expect(markup).toContain('Good morning.');
    expect(markup).toContain('At a café');
  });
});
