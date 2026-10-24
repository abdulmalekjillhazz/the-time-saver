'use client';

import { useState } from 'react';
import { apiRequest } from '../lib/apiClient.js';
import { Button } from './ui/Button.jsx';
import { Card } from './ui/Card.jsx';

export function LandingQuizGrid({ quizzes = [], lang = 'bn' }) {
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState({});
  const [submittingSlot, setSubmittingSlot] = useState(null);
  const isBn = lang === 'bn';

  async function submitAnswer(slot) {
    const answerIndex = answers[slot];
    if (!Number.isInteger(answerIndex) || submittingSlot !== null) return;
    setSubmittingSlot(slot);
    setErrors((current) => ({ ...current, [slot]: '' }));
    try {
      const result = await apiRequest(`/api/lessons/landing-quizzes/${slot}/attempts`, {
        method: 'POST',
        body: { answerIndex, locale: lang },
        locale: lang,
      });
      setResults((current) => ({ ...current, [slot]: result }));
    } catch (err) {
      console.error('Could not submit landing-page quiz answer', err);
      setErrors((current) => ({
        ...current,
        [slot]: err.message || (isBn ? 'উত্তর যাচাই করা যায়নি। আবার চেষ্টা করুন।' : 'Could not check your answer. Please try again.'),
      }));
    } finally {
      setSubmittingSlot(null);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {quizzes.map((quiz) => {
        const result = results[quiz.slot];
        return (
          <Card key={quiz.slot} className="surface-card glass-panel glow-border space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sapphire">
                {isBn ? `অনুশীলন কুইজ ${quiz.slot}` : `Practice quiz ${quiz.slot}`}
              </p>
              <h3 className="mt-2 text-lg font-bold text-ink">{quiz.question[lang]}</h3>
            </div>
            <fieldset disabled={Boolean(result) || submittingSlot === quiz.slot} className="space-y-2">
              <legend className="sr-only">{quiz.question[lang]}</legend>
              {quiz.options.map((option, optionIndex) => {
                const selected = answers[quiz.slot] === optionIndex;
                const correct = result?.correctOption === option[lang] && result?.correct;
                return (
                  <button
                    key={optionIndex}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setAnswers((current) => ({ ...current, [quiz.slot]: optionIndex }));
                      setErrors((current) => ({ ...current, [quiz.slot]: '' }));
                    }}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire disabled:cursor-default ${
                      correct
                        ? 'border-emerald-500 bg-emerald-500/10 text-ink'
                        : selected
                          ? 'border-sapphire bg-sapphire text-on-sapphire shadow-[0_0_12px_rgba(96,165,250,0.4)]'
                          : 'border-sapphire/20 bg-paper text-ink hover:border-gold hover:bg-gold/10'
                    }`}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current/30 text-xs font-bold">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span>{option[lang]}</span>
                  </button>
                );
              })}
            </fieldset>
            {result ? (
              <div className={`rounded-xl border p-3 text-sm ${result.correct ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-gold/40 bg-gold/10'}`} role="status">
                <p className="font-semibold text-ink">
                  {result.correct
                    ? (isBn ? '✓ সঠিক উত্তর!' : '✓ Correct!')
                    : (isBn ? `✗ সঠিক উত্তর: ${result.correctOption}` : `✗ Correct answer: ${result.correctOption}`)}
                </p>
                <p className="mt-1 text-ink/75">{result.explanation}</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setAnswers((current) => ({ ...current, [quiz.slot]: undefined }));
                    setResults((current) => ({ ...current, [quiz.slot]: null }));
                  }}
                >
                  {isBn ? 'আবার চেষ্টা করুন' : 'Try again'}
                </Button>
              </div>
            ) : (
              <Button type="button" disabled={!Number.isInteger(answers[quiz.slot]) || submittingSlot !== null} onClick={() => submitAnswer(quiz.slot)}>
                {submittingSlot === quiz.slot
                  ? (isBn ? 'যাচাই হচ্ছে…' : 'Checking…')
                  : (isBn ? 'উত্তর যাচাই করুন' : 'Check answer')}
              </Button>
            )}
            {errors[quiz.slot] ? <p role="alert" className="text-sm font-semibold text-rose-400">{errors[quiz.slot]}</p> : null}
          </Card>
        );
      })}
    </div>
  );
}
