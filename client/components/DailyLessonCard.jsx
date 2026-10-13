'use client'
import Link from 'next/link';
import { AudioDramaPlayer } from './AudioDramaPlayer.jsx';

import { useState } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';

export function DailyLessonCard({ dailyLesson, quiz, lang = 'bn' }) {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submission, setSubmission] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [loginRequired, setLoginRequired] = useState(false);

  // Quality feedback states
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [isAccurate, setIsAccurate] = useState(null);
  const [isHelpful, setIsHelpful] = useState(null);
  const [shared, setShared] = useState(false);
  const [reportedQuestion, setReportedQuestion] = useState({});
  const [dramaOpen, setDramaOpen] = useState(false);

  if (!dailyLesson) return null;

  const isBn = lang === 'bn';
  const copy = {
    todayLesson: isBn ? 'আজকের দৈনিক পাঠ' : "Today's Daily Lesson",
    takeaway: isBn ? 'মূল শিক্ষা' : 'Key Takeaway',
    vocab: isBn ? 'গুরুত্বপূর্ণ শব্দভাণ্ডার' : 'Vocabulary',
    quizTitle: isBn ? 'দৈনিক কুইজ' : 'Daily Quiz',
    submitQuiz: isBn ? 'কুইজ জমা দিন' : 'Submit Quiz',
    submitting: isBn ? 'যাচাই করা হচ্ছে...' : 'Submitting...',
    scoreTitle: isBn ? 'আপনার ফলাফল' : 'Your Score',
    explanation: isBn ? 'ব্যাখ্যা' : 'Explanation',
    correct: isBn ? 'সঠিক' : 'Correct',
    incorrect: isBn ? 'ভুল' : 'Incorrect',
    helpfulPrompt: isBn ? 'এই পাঠটি কি সহায়ক ছিল?' : 'Was this lesson helpful?',
    accuratePrompt: isBn ? 'তথ্যগুলো কি সঠিক ছিল?' : 'Was this accurate?',
    yes: isBn ? 'হ্যাঁ' : 'Yes',
    no: isBn ? 'না' : 'No',
    thankFeedback: isBn ? 'আপনার মতামতের জন্য ধন্যবাদ!' : 'Thank you for your feedback!',
    share: isBn ? 'শেয়ার করুন' : 'Share Lesson',
    copied: isBn ? 'লিঙ্ক কপি হয়েছে!' : 'Link copied!',
    reportQuestion: isBn ? 'প্রশ্নে ভুল রিপোর্ট করুন' : 'Report wrong answer',
    reported: isBn ? 'রিপোর্ট জমা হয়েছে' : 'Report submitted',
    listenDrama: isBn ? '🎧 গল্প শুনুন' : '🎧 Learn English by Story',
    closeDrama: isBn ? 'ড্রামা প্লেয়ার বন্ধ করুন' : 'Close drama player',
    savedNarration: isBn ? 'AI কণ্ঠে সংরক্ষিত গল্প' : 'Saved AI narration',
    midnightStory: isBn ? 'মধ্যরাতের গল্প • কুইজ • অডিও' : 'MIDNIGHT STORY • QUIZ • AUDIO',
    loginRequired: isBn ? 'কুইজ জমা দিতে আগে লগইন করুন।' : 'Sign in before submitting this quiz.',
    login: isBn ? 'লগইন করুন' : 'Sign in',
    requestFailed: isBn ? 'কুইজ জমা দেওয়া যায়নি। আবার চেষ্টা করুন।' : 'Could not submit the quiz. Please try again.',
    csrfFailed: isBn ? 'নিরাপত্তা যাচাই ব্যর্থ হয়েছে। পেজ রিলোড করে আবার চেষ্টা করুন।' : 'Security check failed. Reload the page and try again.',
    curatedFallback: isBn ? 'সংরক্ষিত বিকল্প গল্প' : 'Curated fallback story',
  };

  const handleSelect = (questionIndex, optionIndex) => {
    if (submission) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
    setError(null);
    setLoginRequired(false);
  };

  const handleSubmit = async () => {
    if (!quiz || !quiz.questions || submitting) return;
    const count = quiz.questions.length;
    const answers = [];
    for (let i = 0; i < count; i += 1) {
      if (selectedAnswers[i] === undefined) {
        setError(isBn ? 'অনুগ্রহ করে সব প্রশ্নের উত্তর দিন।' : 'Please answer all questions before submitting.');
        return;
      }
      answers.push(selectedAnswers[i]);
    }

    setError(null);
    setLoginRequired(false);
    setSubmitting(true);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
      const csrfBody = await csrfResponse.json().catch(() => ({}));
      if (!csrfResponse.ok || typeof csrfBody.csrfToken !== 'string') {
        throw new Error(copy.csrfFailed);
      }
      const res = await fetch('/api/lessons/today/attempts', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfBody.csrfToken,
        },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          setLoginRequired(true);
          setError(copy.loginRequired);
          return;
        }
        const serverMessage = data?.error?.message;
        throw new Error(typeof serverMessage === 'object'
          ? serverMessage[lang] || serverMessage.en || serverMessage.bn || copy.requestFailed
          : typeof serverMessage === 'string' ? serverMessage : copy.requestFailed);
      }
      setSubmission(data);
    } catch (err) {
      console.error('Daily quiz submission failed', err);
      setError(err.message || copy.requestFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedback = async (helpful, accurate) => {
    setIsHelpful(helpful);
    setIsAccurate(accurate);
    setFeedbackSent(true);
    try {
      await fetch('/api/lessons/today/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          helpful,
          accurate,
          rating: helpful ? 5 : 2,
        }),
      });
    } catch {}
  };

  const handleShare = async () => {
    setShared(true);
    try {
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      }
      await fetch('/api/lessons/today/share', { method: 'POST' });
    } catch {}
    setTimeout(() => setShared(false), 3000);
  };

  const handleReportQuestion = async (qIndex) => {
    if (!quiz?._id || reportedQuestion[qIndex]) return;
    setReportedQuestion((prev) => ({ ...prev, [qIndex]: true }));
    try {
      await fetch(`/api/quizzes/${quiz._id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIndex: qIndex,
          reason: 'User flagged question/answer as incorrect',
        }),
      });
    } catch {}
  };

  const storyLines = dailyLesson.content
    ? dailyLesson.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const dialogueLines = storyLines.map((line) => {
    const match = line.match(/^\[([^\]]+)\]\s*:\s*(.*)$/);
    return match ? { speaker: match[1], text: match[2] } : { speaker: null, text: line };
  });

  return (
    <Card className="!p-0 overflow-hidden border-sapphire/20 bg-paper shadow-md">
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-sapphire via-sapphire to-ink px-6 py-5 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.7) 1px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-9 rotate-12 text-white/10">
          <svg viewBox="0 0 120 120" className="h-36 w-36 fill-current">
            <path d="M67 12 76 39 104 40 82 57 90 84 67 68 44 84 52 57 30 40 58 39z" />
            <path d="M25 73 30 87 45 88 33 97 37 112 25 103 13 112 17 97 5 88 20 87z" />
          </svg>
        </div>
        <div className="relative flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-inner shadow-white/10 backdrop-blur">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
              <path d="m4 7 1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
            </svg>
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-soft">{copy.midnightStory}</p>
            <p className="mt-1 text-sm text-white/85">
              {isBn ? 'প্রতিদিন রাত ১২টায় নতুন গল্প ও কুইজ' : 'A fresh story and quiz every night at 12'}
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sapphire/10 pb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-sapphire">
          {copy.todayLesson} • {dailyLesson.date}
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-sapphire/10 px-3 py-1 text-xs font-semibold text-sapphire">
            {dailyLesson.category}
          </span>
          <span className="inline-flex items-center rounded-md border border-ink/30 px-3 py-1 text-xs font-semibold text-ink">
            {dailyLesson.storyType}
          </span>
          <button
            type="button"
            onClick={handleShare}
            className="ml-2 rounded-md border border-sapphire/20 bg-paper/90 px-2.5 py-1 text-xs font-medium text-ink transition hover:border-gold hover:bg-gold/10"
          >
            {shared ? copy.copied : copy.share}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink">{dailyLesson.title}</h2>
        <button
          type="button"
          aria-expanded={dramaOpen}
          onClick={() => setDramaOpen((open) => !open)}
          className="rounded-xl border border-sapphire/25 bg-sapphire/5 px-4 py-2 text-sm font-bold text-sapphire transition hover:border-gold hover:bg-gold/10"
        >
          {dramaOpen ? copy.closeDrama : copy.listenDrama}
        </button>
      </div>
      {dailyLesson.audio?.status === 'ready' && dailyLesson.audio.url ? (
        <div className="mt-4 rounded-xl border border-sapphire/20 bg-sapphire/5 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-sapphire">{copy.savedNarration}</p>
          <audio controls preload="none" src={dailyLesson.audio.url} className="w-full" aria-label={`${copy.savedNarration}: ${dailyLesson.title}`} />
        </div>
      ) : null}
      {dailyLesson.generationSource === 'curated-fallback' ? (
        <p className="mt-2 text-xs font-semibold text-amber-800" role="status">{copy.curatedFallback}</p>
      ) : null}
      {dramaOpen ? <AudioDramaPlayer title={dailyLesson.title} content={dailyLesson.content} lang={lang} onClose={() => setDramaOpen(false)} /> : null}
      <p className="mt-1 text-sm font-medium italic text-ink/70">{dailyLesson.description}</p>

      <div className="mt-4 space-y-1 text-base leading-relaxed text-ink">
        {dialogueLines.map(({ speaker, text }, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5 even:bg-sapphire/5">
            {speaker ? (
              <span className={`mt-0.5 inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                /child|sibling|rafi/i.test(speaker)
                  ? 'bg-gold/15 text-ink'
                  : /female|mother|asha/i.test(speaker)
                    ? 'bg-emerald-100 text-emerald-900'
                    : /male|father|rahim/i.test(speaker)
                      ? 'bg-sapphire/10 text-sapphire'
                      : 'bg-gold/10 text-ink'
              }`}>
                {speaker}
              </span>
            ) : null}
            <p>{text}</p>
          </div>
        ))}
      </div>

      {dailyLesson.keyTakeaway && (
        <div className="routine-tile mt-6 p-4">
          <h3 className="eyebrow">
            {copy.takeaway}
          </h3>
          <p className="mt-1 text-base font-semibold">{dailyLesson.keyTakeaway}</p>
        </div>
      )}

      {dailyLesson.vocabulary && dailyLesson.vocabulary.length > 0 && (
        <div className="mt-6 rounded-xl border border-sapphire/20 bg-sapphire/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-sapphire">
            {copy.vocab}
          </h3>
          <dl className="mt-2 space-y-2">
            {dailyLesson.vocabulary.map((v, i) => (
              <div key={i} className="text-sm">
                <dt className="font-semibold text-ink">{v.term}:</dt>
                <dd className="text-ink/75">{v.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* User Quality Feedback & Inaccuracy Gatekeeper */}
      <div className="mt-6 rounded-xl border border-sapphire/20 bg-paper/80 p-4">
        {!feedbackSent ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{copy.helpfulPrompt}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleFeedback(true, true)}
                className="rounded-md border border-sapphire/20 bg-paper px-3 py-1 font-medium text-ink transition hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-700"
              >
                👍 {copy.yes}
              </button>
              <button
                type="button"
                onClick={() => handleFeedback(false, false)}
                className="rounded-md border border-sapphire/20 bg-paper px-3 py-1 font-medium text-ink transition hover:border-gold hover:bg-gold/10"
              >
                👎 {copy.no}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm font-medium text-sapphire">{copy.thankFeedback}</p>
        )}
      </div>

      {quiz && quiz.questions && quiz.questions.length > 0 && (
        <section className="mt-8 border-t border-sapphire/10 pt-6">
          <h3 className="text-xl font-bold text-ink">{copy.quizTitle}</h3>

          <div className="mt-4 space-y-6">
            {quiz.questions.map((q, qIndex) => {
              const result = submission?.results?.[qIndex];
              return (
                <fieldset key={qIndex} className="rounded-xl border border-sapphire/20 bg-paper p-4 shadow-sm sm:p-5">
                  <legend className="text-base font-semibold leading-relaxed text-ink sm:text-lg">
                    <span className="mr-2 inline-grid h-8 w-8 place-items-center rounded-full bg-sapphire text-sm font-bold text-on-sapphire">{qIndex + 1}</span>
                    {q.text}
                  </legend>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleReportQuestion(qIndex)}
                      className="min-h-11 min-w-11 rounded-lg border border-sapphire/20 px-3 text-sm text-ink/70 transition hover:border-gold hover:bg-gold/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      title={copy.reportQuestion}
                      aria-label={copy.reportQuestion}
                    >
                      {reportedQuestion[qIndex] ? copy.reported : '🚩'}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {q.options.map((opt, oIndex) => {
                      const isSelected = selectedAnswers[qIndex] === oIndex;
                      const isCorrect = result?.correctIndex === oIndex;
                      const isWrongSelected = isSelected && result && !result.correct;

                      let buttonClass = 'border-sapphire/20 bg-paper text-ink hover:border-sapphire/50 hover:bg-sapphire/5';
                      if (submission) {
                        if (isCorrect) buttonClass = 'border-sapphire bg-sapphire/10 text-sapphire font-semibold';
                        else if (isWrongSelected) buttonClass = 'border-gold bg-gold/20 text-ink font-semibold';
                        else buttonClass = 'border-sapphire/10 bg-paper text-ink/55';
                      } else if (isSelected) {
                        buttonClass = 'border-sapphire bg-sapphire text-on-sapphire font-semibold shadow-md ring-2 ring-gold/70';
                      }

                      return (
                        <button
                          key={oIndex}
                          type="button"
                          disabled={Boolean(submission)}
                          aria-pressed={isSelected}
                          onClick={() => handleSelect(qIndex, oIndex)}
                          className={`flex min-h-12 w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left text-base leading-relaxed transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sapphire disabled:cursor-default ${buttonClass}`}
                        >
                          <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                            isSelected && !submission
                              ? 'border-white/60 bg-white/15 text-white'
                              : 'border-current/30'
                          }`}>
                            {String.fromCharCode(65 + oIndex)}
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {isSelected && !submission ? <span aria-hidden="true" className="text-lg font-bold">✓</span> : null}
                        </button>
                      );
                    })}
                  </div>

                  {result && (
                    <div className={`mt-3 rounded-lg border p-3 text-sm ${
                      result.correct ? 'border-sapphire/20 bg-sapphire/5' : 'border-gold/40 bg-gold/10'
                    }`}>
                      <p className="font-semibold text-ink">
                        {result.correct ? `✓ ${copy.correct}` : `✗ ${copy.incorrect}`}
                      </p>
                      <p className="mt-1 text-ink/75">
                        <span className="font-medium">{copy.explanation}:</span> {result.explanation}
                      </p>
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-600">
              {error}{loginRequired ? <> <Link href="/app" className="font-semibold underline">{copy.login}</Link></> : null}
            </p>
          )}

          {!submission ? (
            <div className="mt-6">
              <Button onClick={handleSubmit} disabled={submitting} kind="primary">
                {submitting ? copy.submitting : copy.submitQuiz}
              </Button>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-sapphire/20 bg-sapphire/5 p-4 text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-sapphire">
                {copy.scoreTitle}
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {submission.score} / {submission.total}
              </p>
            </div>
          )}
        </section>
      )}
      </div>
    </Card>
  );
}
