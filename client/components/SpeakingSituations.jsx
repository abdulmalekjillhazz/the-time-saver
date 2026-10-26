'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SPEAKING_SITUATIONS } from '../lib/speakingSituations.js';
import { AudioDramaPlayer } from './AudioDramaPlayer.jsx';
import { ContextSpeakingPractice } from './ContextSpeakingPractice.jsx';
import { Card } from './ui/Card.jsx';

export function SpeakingSituations({ lang = 'bn', dailyLesson = null, onStoryComplete, initialMode = 'dialogue' }) {
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
  const [speakingMode, setSpeakingMode] = useState(initialMode);
  const [autoPlaySignal, setAutoPlaySignal] = useState(0);
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobilePlayerVisible, setMobilePlayerVisible] = useState(() => initialMode === 'free-speech');
  const practiceRef = useRef(null);
  const hasSelectedSituation = useRef(false);
  const selectedSituation = situations.find((item) => item.id === selectedSituationId)
    || situations[0];

  useEffect(() => {
    if (initialMode) {
      setSpeakingMode(initialMode);
      if (initialMode === 'free-speech') {
        setMobilePlayerVisible(true);
      }
    }
  }, [initialMode]);

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
      <Card className={`surface-card space-y-4 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-sapphire-deep/30 via-paper to-gold/10 p-3.5 shadow-xl sm:space-y-5 sm:p-6 ${
        isMobileView && mobilePlayerVisible ? 'mobile-speaking-practice-open' : ''
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/15 pb-3">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/15 text-2xl shadow-inner">
              🗣️
            </span>
            <h2 id="speaking-situations-heading" className="section-heading text-base sm:text-lg font-extrabold text-ink">
              {isBn ? 'পরিস্থিতি অনুযায়ী ইংরেজিতে কথা বলুন' : 'Speak English in real-life situations'}
            </h2>
          </div>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold text-ink/75">
            {isBn ? `${situations.length}টি পরিস্থিতি` : `${situations.length} situations`}
          </span>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-4" role="group" aria-label={isBn ? 'অনুশীলনের পরিস্থিতি' : 'Speaking practice situations'}>
            {situations.map((situation) => {
              const selected = selectedSituationId === situation.id;
              return (
                <div
                  key={situation.id}
                  className={`rounded-2xl border-2 transition-all duration-200 ${
                    selected
                      ? 'border-gold bg-gold/20 shadow-md ring-2 ring-gold/40'
                      : 'border-sapphire/15 bg-paper/75 hover:border-gold/30 hover:bg-gold/5'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    title={situation.description[lang] || situation.description.en}
                    onClick={() => {
                      setSelectedSituationId(situation.id);
                      setMobilePlayerVisible(true);
                      setAutoPlaySignal((signal) => signal + 1);
                    }}
                    className="flex w-full flex-col items-center justify-center p-3 text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-gold/40 sm:p-4"
                  >
                    <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-sapphire/10 text-3xl shadow-inner sm:size-14 sm:text-4xl">
                      {situation.icon}
                    </span>
                    <span className="mt-2 block text-xs font-black leading-snug text-ink line-clamp-2 sm:text-sm">
                      {situation.title[lang] || situation.title.en}
                    </span>
                    <span className="sr-only">{situation.description[lang] || situation.description.en}</span>
                  </button>
                  {selected ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobilePlayerVisible(true);
                        setAutoPlaySignal((signal) => signal + 1);
                      }}
                      className="mx-2 mb-2 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-sapphire px-3 py-1.5 text-xs font-bold text-on-sapphire sm:hidden"
                    >
                      <span aria-hidden="true">▶</span>
                      {isBn ? 'শুরু' : 'Start'}
                    </button>
                  ) : null}
                  {selected && isMobileView && mobilePlayerVisible ? (
                    <div className="px-2 pb-2 sm:px-3 sm:pb-3">
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
