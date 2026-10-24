'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiRequest } from '../lib/apiClient.js';
import { announceLearningActivity } from '../lib/learningFeedback.js';
import { AudioDramaPlayer } from './AudioDramaPlayer.jsx';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';

export function DailyLessonCard({ dailyLesson, quiz, lang = 'bn', collapsible = false, trackLearning = false }) {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submission, setSubmission] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [expanded, setExpanded] = useState(!collapsible);

  const [feedbackSent, setFeedbackSent] = useState(false);
  const [shared, setShared] = useState(false);
  const [reportedQuestion, setReportedQuestion] = useState({});
  const [autoPlaySignal, setAutoPlaySignal] = useState(0);
  const [storyAward, setStoryAward] = useState(null);
  const [storyTrackingError, setStoryTrackingError] = useState('');
  const [storyTrackingBusy, setStoryTrackingBusy] = useState(false);

  const isBn = lang === 'bn';
  const copy = {
    todayLesson: isBn ? 'আজকের গল্প (Story)' : "Today's Story",
    openLesson: isBn ? 'গল্প ও কুইজ খুলুন' : 'Open story and quiz',
    closeLesson: isBn ? 'পাঠ বন্ধ করুন' : 'Close lesson',
    lessonType: isBn ? 'ইংরেজি গল্প · কুইজ' : 'English story · quiz',
    takeaway: isBn ? 'মূল শিক্ষা' : 'Key Takeaway',
    vocab: isBn ? 'গুরুত্বপূর্ণ শব্দভাণ্ডার' : 'Vocabulary',
    quizTitle: isBn ? 'আজকের কুইজ (Quiz)' : 'Daily Quiz',
    submitQuiz: isBn ? 'কুইজ জমা দিন' : 'Submit Quiz',
    submitting: isBn ? 'যাচাই করা হচ্ছে...' : 'Submitting...',
    scoreTitle: isBn ? 'আপনার ফলাফল' : 'Your Score',
    explanation: isBn ? 'ব্যাখ্যা' : 'Explanation',
    correct: isBn ? 'সঠিক' : 'Correct',
    incorrect: isBn ? 'ভুল' : 'Incorrect',
    helpfulPrompt: isBn ? 'এই পাঠটি কি সহায়ক ছিল?' : 'Was this lesson helpful?',
    yes: isBn ? 'হ্যাঁ' : 'Yes',
    no: isBn ? 'না' : 'No',
    thankFeedback: isBn ? 'আপনার মতামতের জন্য ধন্যবাদ!' : 'Thank you for your feedback!',
    share: isBn ? '🔗 লিংক শেয়ার' : '🔗 Share Lesson',
    copied: isBn ? '✓ লিংক কপি হয়েছে!' : '✓ Link copied!',
    reportQuestion: isBn ? 'প্রশ্নে ভুল রিপোর্ট করুন' : 'Report wrong answer',
    reported: isBn ? 'রিপোর্ট জমা হয়েছে' : 'Report submitted',
    listenDrama: isBn ? '🎧 গল্পের অডিও শুনুন' : '🎧 Listen to Story Audio',
    closeDrama: isBn ? '✕ অডিও প্লেয়ার বন্ধ করুন' : '✕ Close Audio Player',
    goToQuiz: isBn ? '🧩 কুইজে অংশ নিন' : '🧩 Take Story Quiz',
    loginRequired: isBn ? 'কুইজ জমা দিতে আগে লগইন করুন।' : 'Sign in before submitting this quiz.',
    login: isBn ? 'লগইন করুন' : 'Sign in',
    requestFailed: isBn ? 'কুইজ জমা দেওয়া যায়নি। আবার চেষ্টা করুন।' : 'Could not submit the quiz. Please try again.',
    offlineSubmit: isBn ? 'অফলাইনে কুইজ দেখা যাবে; উত্তর জমা দিতে ইন্টারনেট লাগবে।' : 'You can read this quiz offline, but need internet to submit answers.',
    csrfFailed: isBn ? 'নিরাপত্তা যাচাই ব্যর্থ হয়েছে। পেজ রিলোড করে আবার চেষ্টা করুন।' : 'Security check failed. Reload the page and try again.',
    curatedFallback: isBn ? 'সংরক্ষিত বিকল্প গল্প' : 'Curated fallback story',
    storyPoints: isBn ? 'গল্প পড়ার জন্য +৫০ পয়েন্ট' : '+50 points for reading',
    storyPointsAlreadyEarned: isBn ? 'এই গল্পের পয়েন্ট আগেই পেয়েছেন।' : 'You already earned points for this story.',
    completeStory: isBn ? 'গল্প পড়া শেষ করেছি' : 'Mark story complete',
    storyCompleted: isBn ? 'গল্প সম্পন্ন—শেখার দিন হিসেবে সংরক্ষিত হয়েছে' : 'Story completed and saved as a learning day',
    trackingError: isBn ? 'গল্প সম্পন্ন হিসেবে সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।' : 'Could not save the completed story. Please try again.',
    quizPoints: isBn ? 'লিডারবোর্ডে অর্জিত পয়েন্ট' : 'Leaderboard points earned',
  };

  const markStoryComplete = async () => {
    if (!trackLearning || !dailyLesson?._id || dailyLesson.isOffline || storyTrackingBusy) return;
    setStoryTrackingError('');
    setStoryTrackingBusy(true);
    try {
      const result = await apiRequest('/api/lessons/today/read', {
        method: 'POST',
        body: { dailyLessonId: dailyLesson._id },
        locale: lang,
      });
      setStoryAward({ lessonId: String(dailyLesson._id), earnedPoints: result.earnedPoints || 0 });
      announceLearningActivity(result.earnedPoints);
    } catch {
      setStoryTrackingError(copy.trackingError);
    } finally {
      setStoryTrackingBusy(false);
    }
  };

  if (!dailyLesson) return null;

  const handleSelect = (questionIndex, optionIndex) => {
    if (submission) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
    setError(null);
    setLoginRequired(false);
  };

  const handleSubmit = async () => {
    if (!quiz || !quiz.questions || submitting) return;
    if (dailyLesson.isOffline) {
      setError(copy.offlineSubmit);
      return;
    }
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
        throw new Error(
          typeof serverMessage === 'object'
            ? serverMessage[lang] || serverMessage.en || serverMessage.bn || copy.requestFailed
            : typeof serverMessage === 'string'
              ? serverMessage
              : copy.requestFailed
        );
      }
      setSubmission(data);
      announceLearningActivity(data.earnedPoints);
    } catch (err) {
      console.error('Daily quiz submission failed', err);
      setError(err.message || copy.requestFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedback = async (helpful, accurate) => {
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

  if (collapsible && !expanded) {
    return (
      <Card id="daily-lesson-full-content" className="surface-card story-reading-card overflow-hidden border border-gold/30 p-0">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-sapphire/10 via-paper to-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wider text-sapphire">
              📖 {copy.lessonType} · {dailyLesson.date}
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-ink sm:text-2xl">{dailyLesson.title}</h2>
            {dailyLesson.description ? (
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink/75">{dailyLesson.description}</p>
            ) : null}
          </div>
          <Button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded="false"
            aria-controls="daily-lesson-full-content"
            className="shrink-0"
          >
            {copy.openLesson}
          </Button>
        </div>
      </Card>
    );
  }

  const questionCount = quiz?.questions?.length || 3;

  return (
    <Card
      id={collapsible ? 'daily-lesson-full-content' : undefined}
      className={`surface-card story-reading-card space-y-6 p-4 sm:p-6 ${collapsible ? 'daily-lesson-reader-screen' : ''}`}
    >
      {collapsible ? (
        <header className="daily-lesson-reader-header">
          <p className="min-w-0 truncate font-bold text-ink">{dailyLesson.title}</p>
          {storyAward?.lessonId === String(dailyLesson._id) && storyAward.earnedPoints > 0 ? (
            <span className="shrink-0 text-xs font-extrabold text-sapphire">+{storyAward.earnedPoints} ⭐</span>
          ) : null}
          <Button type="button" variant="secondary" className="reader-back-button" onClick={() => setExpanded(false)} aria-label={copy.closeLesson} title={copy.closeLesson}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5m7 7-7-7 7-7" />
            </svg>
          </Button>
        </header>
      ) : null}
      {storyTrackingError ? <p role="alert" className="text-sm text-rose-700">{storyTrackingError}</p> : null}
      <div className="rounded-2xl border-2 border-gold/45 bg-paper p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-gold/30 bg-gold/10 p-3.5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-gold-soft">
              📖 {copy.todayLesson} · {dailyLesson.date}
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-ink sm:text-xl">
              {dailyLesson.title}
            </h2>
          </div>

          <div className="rounded-xl border border-sapphire/35 bg-sapphire/10 p-3.5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-sapphire">
              🧩 {copy.quizTitle}
            </p>
            <p className="mt-1 text-lg font-extrabold text-ink sm:text-xl">
              {dailyLesson.title} ({questionCount} {isBn ? 'টি প্রশ্ন' : 'Questions'})
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setAutoPlaySignal((n) => n + 1)}
            className="primary-button flex min-h-[46px] w-full items-center justify-center bg-sapphire px-4 py-2.5 text-sm font-extrabold text-on-sapphire"
          >
            {copy.listenDrama}
          </button>

          <button
            type="button"
            onClick={() => {
              const quizEl = document.getElementById('daily-lesson-quiz-box');
              quizEl?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="secondary-button flex min-h-[46px] w-full items-center justify-center px-4 py-2.5 text-sm font-extrabold"
          >
            {copy.goToQuiz}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="secondary-button flex min-h-[46px] w-full items-center justify-center px-4 py-2.5 text-sm font-extrabold"
          >
            {shared ? copy.copied : copy.share}
          </button>
        </div>
      </div>

      {dailyLesson.generationSource === 'curated-fallback' ? (
        <p className="text-xs font-semibold text-gold-soft" role="status">{copy.curatedFallback}</p>
      ) : null}

      <div className="w-full">
        <AudioDramaPlayer
          title={dailyLesson.title}
          slug={dailyLesson.slug}
          content={dailyLesson.content}
          practiceContent={dailyLesson.locale === 'en' ? dailyLesson.content : ''}
          audioUrl={dailyLesson.audio?.status === 'ready' ? dailyLesson.audio.url : ''}
          vocabulary={dailyLesson.vocabulary || []}
          lang={lang}
          autoPlaySignal={autoPlaySignal}
        />
      </div>

      {trackLearning && !dailyLesson.isOffline ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={storyTrackingBusy || storyAward?.lessonId === String(dailyLesson._id)}
            onClick={markStoryComplete}
          >
            {storyTrackingBusy
              ? (isBn ? 'সংরক্ষণ হচ্ছে…' : 'Saving…')
              : storyAward?.lessonId === String(dailyLesson._id)
                ? `✓ ${copy.storyCompleted}`
                : copy.completeStory}
          </Button>
          {storyAward?.lessonId === String(dailyLesson._id) && storyAward.earnedPoints > 0 ? (
            <span className="text-sm font-bold text-sapphire">+{storyAward.earnedPoints} ⭐</span>
          ) : null}
          {storyAward?.lessonId === String(dailyLesson._id) && storyAward.earnedPoints === 0 ? (
            <span role="status" className="text-sm text-ink/70">{copy.storyPointsAlreadyEarned}</span>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-sapphire/20 bg-paper/80 p-4">
        {!feedbackSent ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{copy.helpfulPrompt}</span>
            <div className="grid grid-cols-2 gap-2 sm:w-56">
              <button
                type="button"
                onClick={() => handleFeedback(true, true)}
                className="secondary-button flex min-h-[42px] w-full items-center justify-center px-3 py-1.5 text-xs font-bold"
              >
                👍 {copy.yes}
              </button>
              <button
                type="button"
                onClick={() => handleFeedback(false, false)}
                className="secondary-button flex min-h-[42px] w-full items-center justify-center px-3 py-1.5 text-xs font-bold"
              >
                👎 {copy.no}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm font-medium text-sapphire">{copy.thankFeedback}</p>
        )}
      </div>

      {collapsible ? (
        <Button type="button" variant="secondary" className="daily-lesson-close-bottom" onClick={() => setExpanded(false)} aria-expanded="true" aria-controls="daily-lesson-full-content">
          {copy.closeLesson}
        </Button>
      ) : null}

      {quiz && quiz.questions && quiz.questions.length > 0 && (
        <section id="daily-lesson-quiz-box" className="scroll-mt-6 border-t border-gold/25 pt-6">
          <div className="rounded-xl border border-gold/35 bg-paper p-3.5 mb-4">
            <h3 className="text-lg font-extrabold text-gold-soft">
              🧩 {copy.quizTitle}: {dailyLesson.title}
            </h3>
          </div>

          <div className="space-y-5">
            {quiz.questions.map((q, qIndex) => {
              const result = submission?.results?.[qIndex];
              return (
                <fieldset key={qIndex} className="rounded-xl border border-sapphire/25 bg-paper p-4 shadow-sm sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <legend className="text-base font-semibold leading-relaxed text-ink sm:text-lg">
                      <span className="mr-2 inline-grid h-8 w-8 place-items-center rounded-full bg-sapphire text-sm font-bold text-on-sapphire">
                        {qIndex + 1}
                      </span>
                      {q.text}
                    </legend>
                    <button
                      type="button"
                      onClick={() => handleReportQuestion(qIndex)}
                      className="min-h-10 min-w-10 shrink-0 rounded-lg border border-sapphire/20 px-2.5 text-xs text-ink/70 transition hover:border-gold hover:bg-gold/10 hover:text-ink"
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
                          className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base leading-relaxed transition-all disabled:cursor-default ${buttonClass}`}
                        >
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${
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
            <p role="alert" className="mt-3 text-sm text-rose-400">
              {error}{loginRequired ? <> <Link href="/app" className="font-semibold underline">{copy.login}</Link></> : null}
            </p>
          )}

          {!submission ? (
            <div className="mt-6">
              <Button onClick={handleSubmit} disabled={submitting || dailyLesson.isOffline} className="min-h-[48px] w-full text-base font-bold">
                {submitting ? copy.submitting : copy.submitQuiz}
              </Button>
              {dailyLesson.isOffline ? <p role="status" className="mt-2 text-sm text-ink/70">{copy.offlineSubmit}</p> : null}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-sapphire/20 bg-sapphire/5 p-4 text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-sapphire">
                {copy.scoreTitle}
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {submission.score} / {submission.total}
              </p>
              {submission.earnedPoints > 0 ? (
                <p className="mt-2 font-bold text-sapphire">+{submission.earnedPoints} ⭐ {copy.quizPoints}</p>
              ) : null}
            </div>
          )}
        </section>
      )}
    </Card>
  );
}
