'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function LoadingScreen({ fullPage = false }) {
  return (
    <div
      className={fullPage ? 'min-h-screen w-full overflow-x-hidden px-4 py-6 sm:px-6 sm:py-10' : 'status-page-shell'}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading Smart Routine"
    >
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {fullPage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-paper/90 px-4 py-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-gold/60 bg-gold/15 text-lg font-extrabold text-gold">
                ✦
              </span>
              <div>
                <p className="text-sm font-extrabold tracking-tight text-gold">Smart Routine</p>
                <p className="text-xs text-ink/70">দৈনিক রুটিন ও অভ্যাস কোচ • Daily Habit Coach</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-sapphire/40 bg-sapphire/15 px-3 py-1 text-xs font-bold text-sapphire">
              <span className="h-2 w-2 animate-ping rounded-full bg-sapphire" aria-hidden="true" />
              <span>সিঙ্ক হচ্ছে / Syncing…</span>
            </span>
          </div>
        ) : null}

        <section className="status-hero-card relative overflow-hidden">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:justify-between gap-5">
            <div className="flex flex-col items-center sm:flex-row sm:items-center gap-4 min-w-0">
              <div className="status-icon-ring shrink-0" aria-hidden="true">
                <svg className="h-9 w-9 animate-spin text-gold" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
                  <path
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke="currentColor"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="eyebrow mx-auto sm:mx-0">✦ SMART ROUTINE • LOADING ✦</p>
                <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl md:text-3xl">
                  আপনার স্মার্ট রুটিন সাজানো হচ্ছে…
                </h1>
                <p className="text-xs font-medium text-ink/80 sm:text-sm">
                  Preparing your daily schedule, prayer anchors, and bilingual habit story
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
              <span className="rounded-full border border-gold/45 bg-gold/15 px-3 py-1 text-xs font-bold text-gold-soft">
                ⚡ অফলাইন ক্যাশ প্রস্তুত
              </span>
              <span className="rounded-full border border-sapphire/45 bg-sapphire/15 px-3 py-1 text-xs font-bold text-sapphire">
                🕌 নামাজ ও রুটিন সিঙ্ক
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="status-progress-track" aria-hidden="true">
              <div className="status-progress-bar" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-ink/70">
              <span>লোড হচ্ছে… অনুগ্রহ করে অপেক্ষা করুন</span>
              <span className="shrink-0 whitespace-nowrap font-mono text-gold-soft">Smart Routine v2</span>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="surface-card rounded-2xl border border-gold/35 p-4 sm:p-5 space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between gap-3 border-b border-gold/20 pb-3">
              <div className="space-y-1.5">
                <div className="status-shimmer h-5 w-44 rounded-lg" />
                <div className="status-shimmer h-3.5 w-64 max-w-full rounded-md opacity-75" />
              </div>
              <div className="status-shimmer h-8 w-24 shrink-0 rounded-full" />
            </div>

            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="routine-tile flex items-center justify-between gap-3 p-3.5">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="status-shimmer h-9 w-9 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="status-shimmer h-4 w-3/4 rounded-md" />
                      <div className="status-shimmer h-3 w-1/2 rounded-md opacity-75" />
                    </div>
                  </div>
                  <div className="status-shimmer h-7 w-20 shrink-0 rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
            <div className="surface-card rounded-2xl border border-gold/35 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-gold">
                  📖 আজকের দ্বিভাষিক গল্প ও কুইজ
                </span>
                <span className="status-shimmer h-6 w-16 rounded-full" />
              </div>
              <div className="status-shimmer h-4 w-5/6 rounded-md" />
              <div className="status-shimmer h-3.5 w-full rounded-md opacity-80" />
              <div className="status-shimmer h-3.5 w-4/5 rounded-md opacity-80" />
              <div className="pt-1 flex gap-2">
                <div className="status-shimmer h-9 flex-1 rounded-xl" />
                <div className="status-shimmer h-9 flex-1 rounded-xl" />
              </div>
            </div>

            <div className="surface-card rounded-2xl border border-gold/35 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-sapphire">
                  🕌 ৫ ওয়াক্ত নামাজ ও অ্যালার্ম
                </span>
                <span className="status-shimmer h-6 w-20 rounded-full" />
              </div>
              <div className="grid grid-cols-5 gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((slot) => (
                  <div key={slot} className="status-shimmer h-12 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorScreen({ error, reset, fullPage = false }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  const handleRetry = () => {
    if (typeof reset === 'function') {
      reset();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const errorCode = error?.digest || (error?.message ? String(error.message).slice(0, 90) : '');

  return (
    <div
      className={fullPage ? 'min-h-screen w-full overflow-x-hidden px-4 py-6 sm:px-6 sm:py-10' : 'status-page-shell'}
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {fullPage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-paper/90 px-4 py-3 shadow-lg">
            <Link href="/bn" className="inline-flex items-center gap-3 text-gold hover:opacity-90">
              <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-gold/60 bg-gold/15 text-lg font-extrabold text-gold">
                ✦
              </span>
              <div>
                <p className="text-sm font-extrabold tracking-tight text-gold">Smart Routine</p>
                <p className="text-xs text-ink/70">দৈনিক রুটিন ও অভ্যাস কোচ</p>
              </div>
            </Link>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${
                isOnline
                  ? 'border-sapphire/45 bg-sapphire/15 text-sapphire'
                  : 'border-gold/55 bg-gold/15 text-gold-soft'
              }`}
            >
              <span aria-hidden="true">{isOnline ? '🌐' : '📴'}</span>
              <span>{isOnline ? 'অনলাইন সংযোগ সচল' : 'অফলাইন মোড সক্রিয়'}</span>
            </span>
          </div>
        ) : null}

        <section className="status-hero-card">
          <div className="flex flex-col items-center text-center">
            <div className="status-icon-ring mb-4" aria-hidden="true">
              <svg className="h-9 w-9 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>

            <p className="eyebrow">✦ SYSTEM RECOVERY • সাময়িক ত্রুটি ✦</p>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl md:text-4xl">
              সাময়িক কারিগরি ত্রুটি হয়েছে
            </h1>
            <p className="mt-1 text-sm font-semibold text-gold-soft sm:text-base">
              Something went wrong while loading this view
            </p>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/85 sm:text-base">
              চিন্তার কিছু নেই—আপনার সংরক্ষিত রুটিন, অ্যালার্ম এবং প্রতিদিনের অগ্রগতি সম্পূর্ণ নিরাপদ আছে। নিচের বাটনে ট্যাপ করে পুনরায় চেষ্টা করুন অথবা সরাসরি মূল পাতায় ফিরে যান।
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                  isOnline
                    ? 'border-sapphire/45 bg-sapphire/15 text-sapphire'
                    : 'border-gold/55 bg-gold/15 text-gold-soft'
                }`}
              >
                <span aria-hidden="true">{isOnline ? '✅' : '⚠️'}</span>
                <span>
                  {isOnline
                    ? 'ইন্টারনেট সংযোগ সচল আছে (Online)'
                    : 'অফলাইন মোড: লোকাল ক্যাশ থেকে রুটিন নিরাপদ আছে'}
                </span>
              </span>
              {errorCode ? (
                <span className="max-w-full truncate rounded-full border border-gold/30 bg-paper/80 px-3 py-1 font-mono text-xs text-ink/70">
                  Ref: {errorCode}
                </span>
              ) : null}
            </div>

            <div className="status-action-grid mt-6">
              <button
                type="button"
                onClick={handleRetry}
                className="primary-button inline-flex min-h-[48px] items-center justify-center gap-2 px-6 py-3 text-sm font-extrabold text-ink"
              >
                <span aria-hidden="true">🔄</span>
                <span>আবার চেষ্টা করুন (Try Again)</span>
              </button>

              <Link
                href="/bn"
                className="secondary-button inline-flex min-h-[48px] items-center justify-center gap-2 px-5 py-3 text-sm font-bold"
              >
                <span aria-hidden="true">🏠</span>
                <span>হোমপেজে ফিরুন (Back Home)</span>
              </Link>

              <Link
                href="/app"
                className="secondary-button inline-flex min-h-[48px] items-center justify-center gap-2 px-5 py-3 text-sm font-bold"
              >
                <span aria-hidden="true">📋</span>
                <span>রুটিন অ্যাপ (/app)</span>
              </Link>
            </div>
          </div>

          <div className="status-info-grid mt-8 border-t border-gold/20 pt-6">
            <div className="routine-tile p-4 text-left space-y-1.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-gold-soft">
                🛡️ ডেটা সম্পূর্ণ নিরাপদ
              </p>
              <p className="text-xs leading-relaxed text-ink/80">
                আপনার রুটিন, স্ট্রিক ও অ্যালার্ম ডিভাইসের অফলাইন স্টোরেজে সুরক্ষিত রয়েছে—কোনো তথ্য হারাবে না।
              </p>
            </div>

            <div className="routine-tile p-4 text-left space-y-1.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-sapphire">
                ⚡ তাৎক্ষণিক সমাধান
              </p>
              <p className="text-xs leading-relaxed text-ink/80">
                &ldquo;আবার চেষ্টা করুন&rdquo; বাটনে ট্যাপ করলে অথবা পেজটি একবার রিলোড করলেই সংযোগ পুনরায় চালু হবে।
              </p>
            </div>

            <div className="routine-tile p-4 text-left space-y-1.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-azure">
                📚 আজকের পাঠ ও গল্প
              </p>
              <p className="text-xs leading-relaxed text-ink/80">
                আপনি চাইলে সরাসরি{' '}
                <Link href="/bn/lessons" className="link-gold">
                  আজকের গল্প ও কুইজ পাতায়
                </Link>{' '}
                গিয়ে অনুশীলন চালিয়ে যেতে পারেন।
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function NotFoundScreen({ fullPage = false }) {
  return (
    <div
      className={fullPage ? 'min-h-screen w-full overflow-x-hidden px-4 py-6 sm:px-6 sm:py-10' : 'status-page-shell'}
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {fullPage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-paper/90 px-4 py-3 shadow-lg">
            <Link href="/bn" className="inline-flex items-center gap-3 text-gold hover:opacity-90">
              <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-gold/60 bg-gold/15 text-lg font-extrabold text-gold">
                ✦
              </span>
              <div>
                <p className="text-sm font-extrabold tracking-tight text-gold">Smart Routine</p>
                <p className="text-xs text-ink/70">দৈনিক রুটিন ও অভ্যাস কোচ</p>
              </div>
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/45 bg-gold/15 px-3 py-1 text-xs font-bold text-gold-soft">
              <span>404 • Page Not Found</span>
            </span>
          </div>
        ) : null}

        <section className="status-hero-card">
          <div className="flex flex-col items-center text-center">
            <div className="status-icon-ring mb-4" aria-hidden="true">
              <span className="font-mono text-xl font-extrabold text-gold">404</span>
            </div>

            <p className="eyebrow">✦ 404 NOT FOUND • পাতাটি খুঁজে পাওয়া যায়নি ✦</p>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl md:text-4xl">
              পাতাটি খুঁজে পাওয়া যায়নি / Page Not Found
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/85 sm:text-base">
              আপনি যে পাতাটি খুঁজছেন তা সরানো হয়েছে, নাম পরিবর্তন করা হয়েছে অথবা এই ঠিকানায় বিদ্যমান নেই। নিচের যেকোনো বাটনে ট্যাপ করে আপনার কাঙ্ক্ষিত পাতায় ফিরে যান।
            </p>

            <div className="status-action-grid mt-6">
              <Link
                href="/bn"
                className="primary-button inline-flex min-h-[48px] items-center justify-center gap-2 px-6 py-3 text-sm font-extrabold text-ink"
              >
                <span aria-hidden="true">🏠</span>
                <span>বাংলা হোমপেজ (/bn)</span>
              </Link>

              <Link
                href="/bn/lessons"
                className="secondary-button inline-flex min-h-[48px] items-center justify-center gap-2 px-5 py-3 text-sm font-bold"
              >
                <span aria-hidden="true">📚</span>
                <span>আজকের পাঠ ও গল্প</span>
              </Link>

              <Link
                href="/app"
                className="secondary-button inline-flex min-h-[48px] items-center justify-center gap-2 px-5 py-3 text-sm font-bold"
              >
                <span aria-hidden="true">📋</span>
                <span>রুটিন অ্যাপ খুলুন</span>
              </Link>

              <Link
                href="/en"
                className="secondary-button inline-flex min-h-[48px] items-center justify-center gap-2 px-5 py-3 text-sm font-bold"
              >
                <span aria-hidden="true">🌐</span>
                <span>English Home (/en)</span>
              </Link>
            </div>
          </div>

          <div className="status-info-grid mt-8 border-t border-gold/20 pt-6">
            <Link href="/app" className="routine-tile block p-4 text-left space-y-1.5 no-underline">
              <p className="text-xs font-extrabold uppercase tracking-wider text-gold-soft">
                🌤️ আজকের রুটিন ও নামাজ
              </p>
              <p className="text-xs leading-relaxed text-ink/80">
                ৫ ওয়াক্ত নামাজের সময় ও অভ্যাসের সাথে মিলিয়ে আপনার প্রতিদিনের কাজের তালিকা সাজান।
              </p>
            </Link>

            <Link href="/bn/lessons" className="routine-tile block p-4 text-left space-y-1.5 no-underline">
              <p className="text-xs font-extrabold uppercase tracking-wider text-sapphire">
                🎧 অডিও গল্প ও শব্দার্থ
              </p>
              <p className="text-xs leading-relaxed text-ink/80">
                শব্দের ওপর ট্যাপ করে তাৎক্ষণিক বাংলা অর্থসহ প্রতিদিনের ইংরেজি সংলাপ ও কুইজ অনুশীলন করুন।
              </p>
            </Link>

            <Link href="/bn/help" className="routine-tile block p-4 text-left space-y-1.5 no-underline">
              <p className="text-xs font-extrabold uppercase tracking-wider text-azure">
                💡 সহায়তা ও গাইড
              </p>
              <p className="text-xs leading-relaxed text-ink/80">
                অ্যাপ ব্যবহারের নিয়ম, অফলাইন মোড ও অ্যালার্ম সেটিংস সম্পর্কে বিস্তারিত জানুন।
              </p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
