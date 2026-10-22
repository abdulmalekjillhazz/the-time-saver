'use client';

import { useMemo, useState } from 'react';
import { SPEAKING_SITUATIONS } from '../lib/speakingSituations.js';
import { AudioDramaPlayer } from './AudioDramaPlayer.jsx';
import { Card } from './ui/Card.jsx';

export function SpeakingSituations({ lang = 'bn', dailyLesson = null }) {
  const isBn = lang === 'bn';
  const situations = useMemo(() => {
    const dailyDialogue = typeof dailyLesson?.body === 'string'
      ? dailyLesson.body
      : typeof dailyLesson?.content === 'string'
        ? dailyLesson.content
        : '';
    if (!dailyDialogue.trim()) return SPEAKING_SITUATIONS;

    return [
      ...SPEAKING_SITUATIONS,
      {
        id: `daily-story-${dailyLesson.date || dailyLesson.slug || 'today'}`,
        icon: '✨',
        title: {
          en: typeof dailyLesson.title === 'string' ? `Today's story: ${dailyLesson.title}` : "Today's AI story",
          bn: 'আজকের গল্পভিত্তিক কথোপকথন',
        },
        category: { en: 'Daily story · New today', bn: 'আজকের নতুন গল্প' },
        description: {
          en: 'Practise speaking with the newest daily story. Fresh story sentences also join sentence practice.',
          bn: 'আজকের নতুন গল্প দিয়ে কথা বলার অনুশীলন করুন। গল্পের বাক্যগুলো sentence practice-এও যোগ হয়।',
        },
        dialogue: dailyDialogue,
      },
    ];
  }, [dailyLesson]);
  const [selectedSituationId, setSelectedSituationId] = useState(() => (
    situations.length > SPEAKING_SITUATIONS.length
      ? situations[situations.length - 1].id
      : SPEAKING_SITUATIONS[0].id
  ));
  const selectedSituation = situations.find((item) => item.id === selectedSituationId)
    || situations[0];

  return (
    <section className="space-y-4" aria-labelledby="speaking-situations-heading">
      <Card className="surface-card space-y-5 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-sapphire-deep/30 via-paper to-gold/10 p-5 shadow-xl sm:p-7">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-3xl shadow-inner">🗣️</span>
            <h2 id="speaking-situations-heading" className="section-heading">
              {isBn ? 'পরিস্থিতি অনুযায়ী ইংরেজিতে কথা বলুন' : 'Speak English in real-life situations'}
            </h2>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-ink/75 sm:text-base">
            {isBn
              ? 'দৈনন্দিন জীবনের একটি পরিস্থিতি বেছে নিন। কথোপকথন শুনুন, শব্দে ট্যাপ করে ধীরে উচ্চারণ শিখুন, তারপর নিজে বলে অনুশীলন করুন।'
              : 'Choose an everyday situation. Listen to the conversation, tap any word to hear a slow pronunciation in context, then practise saying each line.'}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-ink/75">
              {isBn ? 'আপনি কোন পরিস্থিতিতে অনুশীলন করতে চান?' : 'Choose a situation to practise'}
            </h3>
            <span className="text-xs font-semibold text-ink/60">
              {isBn ? `${situations.length}টি পরিস্থিতি` : `${situations.length} situations`}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label={isBn ? 'অনুশীলনের পরিস্থিতি' : 'Speaking practice situations'}>
            {situations.map((situation) => {
              const selected = selectedSituationId === situation.id;
              return (
                <button
                  key={situation.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedSituationId(situation.id)}
                  className={`group flex min-h-28 items-start gap-4 rounded-2xl border-2 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/40 ${
                    selected
                      ? 'border-gold bg-gold/15 shadow-md'
                      : 'border-sapphire/15 bg-paper/75 hover:border-gold/70'
                  }`}
                >
                  <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sapphire/10 text-3xl transition-transform group-hover:scale-105">
                    {situation.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.68rem] font-bold uppercase tracking-wider text-ink/60">
                      {situation.category[lang] || situation.category.en}
                    </span>
                    <span className="mt-1 block text-base font-extrabold leading-snug text-ink">
                      {situation.title[lang] || situation.title.en}
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-ink/75">
                      {situation.description[lang] || situation.description.en}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 border-t border-gold/20 pt-5">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold/15 text-2xl">
              {selectedSituation.icon}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink/60">
                {selectedSituation.category[lang] || selectedSituation.category.en}
              </p>
              <h3 className="text-lg font-extrabold text-ink">
                {selectedSituation.title[lang] || selectedSituation.title.en}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-ink/75">
                {selectedSituation.description[lang] || selectedSituation.description.en}
              </p>
            </div>
          </div>
          <AudioDramaPlayer
            key={`speaking-situation-${selectedSituation.id}`}
            title={selectedSituation.title.en}
            content={selectedSituation.dialogue}
            practiceContent={selectedSituation.dialogue}
            lang={lang}
          />
        </div>
      </Card>
    </section>
  );
}
