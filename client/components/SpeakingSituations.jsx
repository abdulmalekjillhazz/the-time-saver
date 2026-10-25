'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SPEAKING_SITUATIONS } from '../lib/speakingSituations.js';
import { AudioDramaPlayer } from './AudioDramaPlayer.jsx';
import { Card } from './ui/Card.jsx';

export function SpeakingSituations({ lang = 'bn', dailyLesson = null, onStoryComplete }) {
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
          en: typeof dailyLesson.title === 'string' ? dailyLesson.title : "Today's story",
          bn: 'আজকের গল্প',
        },
        category: { en: 'Daily story · New today', bn: 'আজকের নতুন গল্প' },
        description: {
          en: "Practise speaking with today's story.",
          bn: 'আজকের গল্প দিয়ে কথা বলার অনুশীলন করুন।',
        },
        dialogue: dailyDialogue,
        slug: dailyLesson.slug || '',
        audioUrl: dailyLesson.audio?.status === 'ready' ? dailyLesson.audio.url : '',
        completionId: dailyLesson._id,
      },
    ];
  }, [dailyLesson]);
  const [selectedSituationId, setSelectedSituationId] = useState(() => (
    situations.length > SPEAKING_SITUATIONS.length
      ? situations[situations.length - 1].id
      : SPEAKING_SITUATIONS[0].id
  ));
  const [autoPlaySignal, setAutoPlaySignal] = useState(0);
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobilePlayerVisible, setMobilePlayerVisible] = useState(false);
  const practiceRef = useRef(null);
  const hasSelectedSituation = useRef(false);
  const selectedSituation = situations.find((item) => item.id === selectedSituationId)
    || situations[0];

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const updateViewport = () => setIsMobileView(query.matches);
    updateViewport();
    query.addEventListener('change', updateViewport);
    return () => query.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (!hasSelectedSituation.current) {
      hasSelectedSituation.current = true;
      return;
    }

    if (window.matchMedia?.('(max-width: 639px)').matches) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    practiceRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [selectedSituationId]);

  return (
    <section className="speaking-situations-section space-y-4" aria-labelledby="speaking-situations-heading">
      <Card className={`surface-card space-y-4 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-sapphire-deep/30 via-paper to-gold/10 p-3 shadow-xl sm:space-y-5 sm:p-7 ${
        isMobileView && mobilePlayerVisible ? 'mobile-speaking-practice-open' : ''
      }`}>
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
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3" role="group" aria-label={isBn ? 'অনুশীলনের পরিস্থিতি' : 'Speaking practice situations'}>
            {situations.map((situation) => {
              const selected = selectedSituationId === situation.id;
              return (
                <div
                  key={situation.id}
                  className={`rounded-xl border-2 transition-colors duration-200 sm:rounded-2xl ${
                    selected && isMobileView && mobilePlayerVisible ? 'overflow-visible' : 'overflow-hidden'
                  } ${
                    selected
                      ? 'border-gold bg-gold/15 shadow-md'
                      : 'border-sapphire/15 bg-paper/75'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedSituationId(situation.id);
                      setMobilePlayerVisible(false);
                    }}
                    className="group flex min-h-0 w-full items-start gap-2 p-2 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-gold/40 sm:min-h-28 sm:gap-4 sm:p-4"
                  >
                    <span aria-hidden="true" className="grid size-[4.5rem] shrink-0 place-items-center rounded-2xl bg-sapphire/10 text-5xl sm:size-16 sm:text-4xl">
                      {situation.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.68rem] font-bold uppercase tracking-wider text-ink/60">
                        {situation.category[lang] || situation.category.en}
                      </span>
                      <span className="mt-1 block text-base font-extrabold leading-snug text-ink">
                        {situation.title[lang] || situation.title.en}
                      </span>
                      <span className="mt-1 line-clamp-1 block text-sm leading-snug text-ink/75 sm:mt-1.5 sm:line-clamp-none sm:leading-relaxed">
                        {situation.description[lang] || situation.description.en}
                      </span>
                    </span>
                  </button>
                  {selected ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobilePlayerVisible(true);
                        setAutoPlaySignal((signal) => signal + 1);
                      }}
                      className="mx-3 mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-sapphire px-4 py-2 text-sm font-bold text-on-sapphire focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/40 sm:hidden"
                    >
                      <span aria-hidden="true">▶</span>
                      {isBn ? 'শুরু' : 'Start'}
                    </button>
                  ) : null}
                  {selected && isMobileView && mobilePlayerVisible ? (
                    <div className="px-3 pb-3">
                      <AudioDramaPlayer
                        key={`speaking-situation-${selectedSituation.id}`}
                        title={selectedSituation.title.en}
                        slug={selectedSituation.slug || ''}
                        content={selectedSituation.dialogue}
                        practiceContent={selectedSituation.dialogue}
                        audioUrl={selectedSituation.audioUrl || ''}
                        lang={lang}
                        autoPlaySignal={autoPlaySignal}
                        startInPracticeMode
                        initialChunkMode={false}
                        onComplete={selectedSituation.completionId && onStoryComplete
                          ? () => onStoryComplete(selectedSituation.completionId)
                          : undefined}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div id="speaking-practice-panel" ref={practiceRef} className="hidden scroll-mt-24 space-y-3 border-t border-gold/20 pt-5 sm:block">
          <div className="hidden items-start gap-3 sm:flex">
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
            slug={selectedSituation.slug || ''}
            content={selectedSituation.dialogue}
            practiceContent={selectedSituation.dialogue}
            audioUrl={selectedSituation.audioUrl || ''}
            lang={lang}
            autoPlaySignal={autoPlaySignal}
            initialChunkMode={false}
            onComplete={selectedSituation.completionId && onStoryComplete
              ? () => onStoryComplete(selectedSituation.completionId)
              : undefined}
          />
        </div>
      </Card>
    </section>
  );
}
