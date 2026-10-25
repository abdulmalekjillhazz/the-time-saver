import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, pageMetadata, DEFAULT_LANG, BRAND, absUrl, SITE_URL, breadcrumbData } from '../../../lib/seo.js';
import { getDictionary } from '../../../i18n/dictionaries.js';
import { JsonLd } from '../../../components/JsonLd.jsx';
import { getIslamicReflection, getLandingQuizzes, getLessons, getTodayLesson } from '../../../lib/api.js';
import { ANDROID_APK_DOWNLOAD_URL } from '../../../lib/downloads.js';
import { AudioDramaPlayer } from '../../../components/AudioDramaPlayer.jsx';
import { LandingQuizGrid } from '../../../components/LandingQuizGrid.jsx';
import { StoryReader } from '../../../components/StoryReader.jsx';

export const revalidate = 60;

export async function generateMetadata(props) {
  const params = await props.params;
  if (!isLang(params.lang)) return {};
  const d = getDictionary(params.lang).home;
  const fullTitle = `${d.title} | ${BRAND}`;
  return pageMetadata({
    lang: params.lang,
    path: '',
    title: fullTitle.length <= 60 ? fullTitle : d.title,
    description: d.description,
  });
}

export default async function HomePage(props) {
  const params = await props.params;
  if (!isLang(params.lang)) notFound();
  const lang = params.lang;
  const isBn = lang === 'bn';
  const home = getDictionary(lang).home;
  const [today, published, landingQuizResult, reflectionResult] = await Promise.all([
    getTodayLesson(lang),
    getLessons(),
    getLandingQuizzes(),
    getIslamicReflection(lang),
  ]);
  const dailyLesson = today.ok ? today.dailyLesson : null;
  const dailyQuiz = today.ok ? today.quiz : null;
  const recentLessons = published.ok ? published.lessons.slice(0, 3) : [];
  const landingQuizzes = landingQuizResult.ok ? landingQuizResult.quizzes : [];
  const reflection = reflectionResult.ok ? reflectionResult.reflection : null;

  const features = isBn ? [
    {
      icon: '🧠',
      tag: 'পাঠ ও কুইজ',
      title: 'দৈনিক পাঠ ও গল্পভিত্তিক কুইজ',
      desc: 'প্রকাশিত ছোট পাঠ পড়ুন এবং গল্পের বিষয় নিয়ে কুইজে অংশ নিন।',
    },
    {
      icon: '⚡',
      tag: 'পরিকল্পনা',
      title: 'নিজের মতো রুটিন ও রিমাইন্ডার',
      desc: 'আপনার সময়ের সঙ্গে মানানসই রুটিন তৈরি করুন, কাজের গুরুত্ব ঠিক করুন এবং রিমাইন্ডার বেছে নিন।',
    },
    {
      icon: '📊',
      tag: 'অগ্রগতি',
      title: 'অভ্যাসের অগ্রগতি ও স্ট্রিক',
      desc: 'সম্পন্ন কাজ ও পাঠের ইতিহাস দেখে সময়ের সঙ্গে আপনার ধারাবাহিকতা বুঝুন।',
    },
    {
      icon: '🎧',
      tag: 'অডিও',
      title: 'ডিভাইসের কণ্ঠে গল্প শুনুন',
      desc: 'সমর্থিত ব্রাউজারে speech synthesis ব্যবহার করে গল্পের সংলাপ শুনুন।',
    },
    {
      icon: '🏅',
      tag: 'মাইলফলক',
      title: 'পাঠের জন্য পয়েন্ট ও ব্যাজ',
      desc: 'পাঠ সম্পন্ন করে পয়েন্ট অর্জন করুন এবং শেখার ধারাবাহিকতার মাইলফলক দেখুন।',
    },
    {
      icon: '🕌',
      tag: 'ক্যালেন্ডার',
      title: 'নামাজের সময় ও ছুটির দিন',
      desc: 'ঐচ্ছিকভাবে নামাজের সময় ও বাংলাদেশের ছুটির দিন দেখে আপনার দিন সাজান।',
    },
  ] : [
    {
      icon: '🧠',
      tag: 'Lessons & quizzes',
      title: 'Daily lessons and story quizzes',
      desc: 'Read published short lessons and take quizzes about what you have learned.',
    },
    {
      icon: '⚡',
      tag: 'Planning',
      title: 'Flexible routines and reminders',
      desc: 'Create routines around your schedule, set priorities, and choose reminders that work for you.',
    },
    {
      icon: '📊',
      tag: 'Progress',
      title: 'Habit progress and learning streaks',
      desc: 'Review completed activities and lesson history to see your consistency over time.',
    },
    {
      icon: '🎧',
      tag: 'Audio',
      title: 'Listen to stories in a device voice',
      desc: 'Use speech synthesis in supported browsers to listen to story dialogue.',
    },
    {
      icon: '🏅',
      tag: 'Milestones',
      title: 'Points and badges for learning',
      desc: 'Earn points for completing lessons and see milestones for your learning streak.',
    },
    {
      icon: '🕌',
      tag: 'Calendar',
      title: 'Prayer times and holidays',
      desc: 'Optionally check prayer times and Bangladesh holidays while planning your day.',
    },
  ];

  const faqs = isBn ? [
    { q: 'Smart Routine কি সত্যিই বিনামূল্যে ব্যবহার করা যাবে?', a: 'হ্যাঁ! অ্যাপের কোর ফিচারসমূহ, রুটিন প্ল্যানার, এআই লেসন ও হিটম্যাপ সম্পূর্ণ বিনামূল্যে ব্যবহার করা যায়।' },
    { q: 'ইন্টারনেট কানেকশন না থাকলে কি অ্যাপ চলবে?', a: 'অবশ্যই। Smart Routine একটি অফলাইন-ফার্স্ট প্রগ্রেসিভ অ্যাপ। ইন্টারনেট না থাকলেও আপনার রুটিন ডাটা লোকালি সংরক্ষিত থাকে।' },
    { q: 'আমার ব্যক্তিগত তথ্যের গোপনীয়তা কীভাবে রক্ষা করা হয়?', a: 'আপনার রুটিন ও ডায়েরি ১০০% ব্যক্তিগত। আপনার ডাটা কারো কাছে বিক্রি বা অপব্যবহার করা হয় না।' },
  ] : [
    { q: 'Is Smart Routine completely free to use?', a: 'Yes! The core planner, daily AI habit lessons, quizzes, and heatmaps are 100% free with no hidden charges.' },
    { q: 'Does the app work without an active internet connection?', a: 'Absolutely. Smart Routine is an offline-first app. Your habits and alarms function even when you are disconnected.' },
    { q: 'How is my personal habit data protected?', a: 'Your routines are strictly private. All habit analytics remain securely scoped to your authenticated account.' },
  ];

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: BRAND,
      url: SITE_URL,
      logo: `${SITE_URL}/brand-logo.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: BRAND,
      url: absUrl(lang, ''),
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'All',
      inLanguage: isBn ? 'bn' : 'en',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'BDT' },
      description: isBn ? 'দৈনিক এআই পাঠ ও রুটিন কোচ' : 'AI-powered daily habit planner and coach',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    breadcrumbData(lang, [{ name: BRAND, path: '' }]),
  ];

  return (
    <>
      <JsonLd data={structuredData} />

      <div className="landing-page space-y-16 py-4">
        {/* Masterclass Hero Section */}
        <section
          className="landing-hero app-hero relative isolate overflow-hidden rounded-3xl p-6 sm:p-10 lg:p-14 shadow-2xl grid lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div className="lg:col-span-7 space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold/15 px-3.5 py-1 text-xs font-extrabold text-gold shadow-[0_0_15px_rgba(242,193,78,0.25)]">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{isBn ? '✨ দৈনিক রুটিন প্ল্যানার ও এআই অভ্যাস কোচ' : '✨ AI Daily Routine Planner & Habit Coach'}</span>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-ink sm:text-5xl lg:text-5xl leading-[1.14]">
              {home.h1}
            </h1>

            <p className="hero-description text-base sm:text-lg leading-relaxed text-ink/85 max-w-xl">
              {home.lead}
            </p>

            <div className="landing-actions flex flex-wrap items-center gap-3.5 pt-2">
              <Link
                href="/app"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 px-6 py-3 text-base font-black text-slate-950 shadow-[0_0_24px_rgba(242,193,78,0.5)] transition-all hover:scale-[1.03] hover:shadow-[0_0_32px_rgba(242,193,78,0.7)] active:scale-95"
              >
                <span>🚀</span>
                <span>{isBn ? 'বিনামূল্যে শুরু করুন' : 'Get Started Free'}</span>
              </Link>

              <a
                href={ANDROID_APK_DOWNLOAD_URL}
                download
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-gold/70 bg-paper/80 backdrop-blur-md px-5 py-3 text-sm font-bold text-ink shadow-lg transition-all hover:border-gold hover:bg-gold/15 hover:scale-[1.02] active:scale-95"
              >
                <span>📱</span>
                <span>{home.ctaAndroid}</span>
              </a>

              <Link
                href={`/${lang}/lessons`}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-sapphire/45 bg-sapphire/15 px-4 py-3 text-sm font-bold text-sapphire transition-all hover:bg-sapphire/25 hover:border-sapphire hover:scale-[1.02]"
              >
                <span>📖</span>
                <span>{isBn ? 'আজকের পাঠ পড়ুন' : 'Explore Lessons'}</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-ink/80 pt-1">
              <span className="flex items-center gap-1.5"><span className="text-emerald-400 font-black">✓</span> {isBn ? '১০০% ফ্রি' : '100% Free'}</span>
              <span className="opacity-40">•</span>
              <span className="flex items-center gap-1.5"><span className="text-emerald-400 font-black">✓</span> {isBn ? 'কোনো কার্ড লাগবে না' : 'No Credit Card'}</span>
              <span className="opacity-40">•</span>
              <span className="flex items-center gap-1.5"><span className="text-emerald-400 font-black">✓</span> {isBn ? 'অফলাইন-ফার্স্ট' : 'Offline First'}</span>
              <span className="opacity-40">•</span>
              <span className="flex items-center gap-1.5"><span className="text-emerald-400 font-black">✓</span> {isBn ? 'বাংলা ও ইংরেজি' : 'Bangla & English'}</span>
            </div>
            <p className="text-xs text-ink/65 italic max-w-lg">{home.androidDownloadNote}</p>
          </div>

          {/* Interactive Live App Simulator Card */}
          <div className="lg:col-span-5 relative z-10 w-full" aria-hidden="true">
            <div className="relative mx-auto w-full max-w-md rounded-2xl border-2 border-gold/45 bg-gradient-to-b from-[#0a1526]/95 via-[#06101e]/95 to-[#030813]/95 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl">
              {/* App Simulator Top Bar */}
              <div className="flex items-center justify-between border-b border-gold/20 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span className="text-xs font-black tracking-wide text-gold">SMART ROUTINE</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-gold/50 bg-gold/15 px-2.5 py-0.5 text-xs font-extrabold text-gold shadow-sm">
                    🔥 7-Day Streak
                  </span>
                </div>
              </div>

              {/* Today's Focus Routine Heading + Progress */}
              <div className="mt-4 rounded-xl border border-sapphire/35 bg-sapphire/10 p-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-sapphire-light">✦ {isBn ? 'আজকের ফোকাস অগ্রগতি' : "Today's Routine Focus"}</span>
                  <span className="text-emerald-400 font-black">75% {isBn ? 'সম্পন্ন' : 'Done'}</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-500 shadow-[0_0_10px_#10b981]" />
                </div>
              </div>

              {/* Routine Items List */}
              <div className="mt-3.5 space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓</span>
                    <span className="text-ink font-bold">{isBn ? 'ফজর ও সকালের হাঁটা' : 'Morning Walk & Mind'}</span>
                  </div>
                  <span className="font-mono text-emerald-400/90 text-xs font-bold">06:00 AM</span>
                </div>

                <div className="relative flex items-center justify-between rounded-xl border-2 border-gold/60 bg-gold/15 p-2.5 text-xs font-bold shadow-[0_0_15px_rgba(242,193,78,0.2)]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/30 text-gold text-xs">⚡</span>
                    <span className="text-gold-light">{isBn ? 'ডিপ ওয়ার্ক ও গণিত (২৫ মি.)' : 'Deep Work & Study (25m)'}</span>
                  </div>
                  <span className="rounded bg-gold/30 px-1.5 py-0.5 font-mono text-[11px] text-gold font-bold">{isBn ? 'চলছে' : 'Active'}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-sapphire/30 bg-sapphire/10 p-2.5 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sapphire/20 text-sapphire text-xs">🎧</span>
                    <span className="text-ink">{isBn ? 'এআই গল্প পাঠ ও কুইজ' : 'AI Habit Story & Quiz'}</span>
                  </div>
                  <span className="font-mono opacity-80 text-xs">08:00 PM</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-gold/20 bg-paper/40 p-2.5 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-paper/60 text-xs">🌙</span>
                    <span className="text-ink/80">{isBn ? 'দিনের মূল্যায়ন ও ঘুম' : 'Evening Review & Sleep'}</span>
                  </div>
                  <span className="font-mono opacity-70 text-xs">10:30 PM</span>
                </div>
              </div>

              {/* Level & XP Footer Pill */}
              <div className="mt-3.5 flex items-center justify-between rounded-xl border border-gold/40 bg-gradient-to-r from-gold/15 to-amber-500/10 p-2.5 text-xs font-black">
                <span className="text-gold-soft flex items-center gap-1.5">
                  <span>🌟</span>
                  <span>{isBn ? 'লেভেল ২ · অটল শিক্ষার্থী' : 'Level 2 · Steadfast Learner'}</span>
                </span>
                <span className="font-mono text-gold">180 / 200 XP</span>
              </div>
            </div>
          </div>
        </section>

        <section id="daily-story" className="surface-card story-reading-card scroll-mt-8 overflow-hidden p-5 sm:p-8">
          <div className="rounded-2xl border-2 border-gold/45 bg-paper p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gold/30 bg-gold/10 p-3.5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-gold-soft">
                  📖 {isBn ? 'আজকের গল্প (Story)' : "Today's Story"}
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-ink sm:text-xl">
                  {dailyLesson?.title || (isBn ? 'আজকের গল্প শিগগিরই আসছে' : "Today's story is coming soon")}
                </h2>
              </div>

              <div className="rounded-xl border border-sapphire/35 bg-sapphire/10 p-3.5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-sapphire">
                  🧩 {isBn ? 'আজকের কুইজ (Quiz)' : 'Daily Story Quiz'}
                </p>
                <p className="mt-1 text-lg font-extrabold text-ink sm:text-xl">
                  {dailyLesson?.title
                    ? `${dailyLesson.title} (${dailyQuiz?.questions?.length || 3} ${isBn ? 'টি প্রশ্ন' : 'Questions'})`
                    : (isBn ? 'গল্পভিত্তিক কুইজ' : 'Story-based Quiz')}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href={`/${lang}/lessons`}
                className="primary-button flex min-h-[46px] w-full items-center justify-center bg-sapphire px-5 py-2.5 text-center text-sm font-extrabold text-on-sapphire"
              >
                📖 {isBn ? 'সকল পাঠ ও গল্প দেখুন' : 'Browse All Lessons & Stories'}
              </Link>
              <a
                href="#home-story-quiz-box"
                className="secondary-button flex min-h-[46px] w-full items-center justify-center px-5 py-2.5 text-center text-sm font-extrabold"
              >
                🧩 {isBn ? 'কুইজে অংশ নিন' : 'Jump to Story Quiz'}
              </a>
            </div>
          </div>

          {dailyLesson ? (
            <div className="mt-6 space-y-6">
              <div className="w-full">
                <AudioDramaPlayer
                  title={dailyLesson.title}
                  slug={dailyLesson.slug}
                  content={dailyLesson.content}
                  practiceContent={dailyLesson.locale === 'en' ? dailyLesson.content : ''}
                  vocabulary={dailyLesson.vocabulary || []}
                  lang={lang}
                />
              </div>

              <aside id="home-story-quiz-box" className="routine-tile scroll-mt-6 p-4 sm:p-6">
                <div className="rounded-xl border border-gold/35 bg-paper p-3.5">
                  <h3 className="text-lg font-extrabold text-gold-soft">
                    🧩 {isBn ? `গল্প থেকে কুইজ: ${dailyLesson.title}` : `Quick Story Quiz: ${dailyLesson.title}`}
                  </h3>
                </div>
                {dailyQuiz?.questions?.length ? (
                  <ol className="mt-4 grid gap-4 md:grid-cols-3">
                    {dailyQuiz.questions.map((question, questionIndex) => (
                      <li key={questionIndex} className="rounded-xl border border-gold/25 bg-paper/70 p-4">
                        <p className="text-sm font-bold text-ink">{questionIndex + 1}. {question.text}</p>
                        <ul className="mt-2.5 space-y-1.5 text-sm opacity-85">
                          {question.options.map((option, optionIndex) => (
                            <li key={optionIndex} className="rounded-lg border border-sapphire/15 bg-paper/50 px-2.5 py-1.5">
                              {String.fromCharCode(65 + optionIndex)}. {option.text}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-3 text-sm opacity-80">{isBn ? 'কুইজ তৈরি হচ্ছে।' : 'The quiz is being prepared.'}</p>}
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Link href="/app" className="primary-button flex min-h-[46px] w-full items-center justify-center bg-sapphire px-5 py-3 text-center text-sm font-extrabold text-on-sapphire">
                    🚀 {isBn ? 'অ্যাপে কুইজ জমা দিন ও রুটিন শুরু করুন' : 'Submit Quiz & Start Routine in App'}
                  </Link>
                  <Link href={`/${lang}/lessons`} className="secondary-button flex min-h-[46px] w-full items-center justify-center px-5 py-3 text-center text-sm font-extrabold">
                    📚 {isBn ? 'আগের সব গল্প ও কুইজ দেখুন' : 'Explore Past Stories & Quizzes'}
                  </Link>
                </div>
              </aside>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              <p className="opacity-80">{isBn ? 'আজকের গল্প, কুইজ ও অডিও প্লেয়ার এখানে দেখানো হবে।' : "The latest story, quiz, and audio player will appear here."}</p>
              <Link href="/app" className="primary-button mt-4 inline-flex bg-sapphire px-5 py-3 font-bold text-on-sapphire">
                {isBn ? 'বিনামূল্যে শুরু করুন' : 'Get started for free'}
              </Link>
            </div>
          )}
        </section>

        {reflection ? (
          <section className="surface-card p-6 sm:p-8" aria-labelledby="daily-reflection-title">
            <p className="eyebrow">✦ {isBn ? 'আজকের কুরআন ও হাদিস স্মরণ' : "Today's Quran & Hadith reflection"}</p>
            <h2 id="daily-reflection-title" className="section-heading mt-2 text-2xl sm:text-3xl">
              {reflection.title}
            </h2>
            <p className="mt-3 max-w-3xl leading-relaxed opacity-90">{reflection.reflection}</p>
            <div className="routine-tile mt-4 p-4">
              <p className="text-sm font-semibold">
                {isBn ? 'আজকের ছোট অভ্যাস: ' : 'A small practice for today: '}
                <span className="font-normal">{reflection.practicalAction}</span>
              </p>
              {reflection.sourceType !== 'general' && reflection.sourceCitation ? (
                <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-soft">
                  <span>{reflection.sourceType === 'quran' ? '📖' : '📜'}</span>
                  <span>{isBn ? 'উৎস: ' : 'Source: '}{reflection.sourceCitation}</span>
                </p>
              ) : null}
            </div>
            <p className="mt-3 text-xs opacity-75">
              {isBn ? 'এটি একটি অনুপ্রেরণামূলক স্মরণ, ফতোয়া নয়।' : 'A reflection for inspiration, not a religious ruling.'}
            </p>
          </section>
        ) : null}

        {landingQuizzes.length ? (
          <section className="space-y-4" aria-labelledby="landing-quizzes-title">
            <div className="max-w-2xl">
              <h2 id="landing-quizzes-title" className="text-2xl font-extrabold text-ink sm:text-3xl">
                {isBn ? 'দুটি কুইজ চেষ্টা করে দেখুন' : 'Try two quick quizzes'}
              </h2>
              <p className="mt-2 text-sm text-ink/85">
                {isBn ? 'অ্যাকাউন্ট ছাড়াই উত্তর দিন, সঙ্গে সঙ্গে ফল ও ব্যাখ্যা দেখুন।' : 'Answer without an account and get immediate feedback with an explanation.'}
              </p>
            </div>
            <LandingQuizGrid quizzes={landingQuizzes} lang={lang} />
            <div className="surface-card flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
              <div>
                <p className="eyebrow">✦ {isBn ? 'আরও কুইজ চান?' : 'Want more quizzes?'}</p>
                <p className="mt-1 text-sm font-semibold">
                  {isBn ? 'লগইন ছাড়াই এই ২টি কুইজ দেওয়া যায়। আরও গল্প, কুইজ ও অডিও পেতে লগইন করুন।' : 'These 2 quizzes work without login. Please login to explore daily stories, full quizzes and audio.'}
                </p>
              </div>
              <Link href="/app" className="primary-button inline-flex shrink-0 bg-sapphire px-6 py-3 font-bold text-on-sapphire">
                {isBn ? '🔑 আরও দেখতে লগইন করুন' : '🔑 Login to explore more'}
              </Link>
            </div>
          </section>
        ) : null}

        <section className="surface-card glass-panel glow-border grid grid-cols-2 gap-4 p-6 text-center sm:grid-cols-4">
          <div className="enter-up" style={{ '--enter-delay': '0ms' }}><p className="text-2xl font-black text-gold sm:text-3xl">🌙</p><p className="mt-1 text-xs font-medium opacity-90">{isBn ? 'প্রতিদিন নতুন গল্প' : 'A fresh daily story'}</p></div>
          <div className="enter-up" style={{ '--enter-delay': '80ms' }}><p className="text-2xl font-black text-sapphire sm:text-3xl">🧩</p><p className="mt-1 text-xs font-medium opacity-90">{isBn ? 'গল্পভিত্তিক কুইজ' : 'Story-based quizzes'}</p></div>
          <div className="enter-up" style={{ '--enter-delay': '160ms' }}><p className="text-2xl font-black text-gold sm:text-3xl">🎧</p><p className="mt-1 text-xs font-medium opacity-90">{isBn ? 'শুনে শেখার সুবিধা' : 'Listen as you learn'}</p></div>
          <div className="enter-up" style={{ '--enter-delay': '240ms' }}><p className="text-2xl font-black text-sapphire sm:text-3xl">🇧🇩</p><p className="mt-1 text-xs font-medium opacity-90">{isBn ? 'বাংলা ও ইংরেজি' : 'Bangla and English'}</p></div>
        </section>

        {recentLessons.length ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">{isBn ? 'নতুন প্রকাশিত পাঠ' : 'Recently published lessons'}</h2>
                <p className="mt-1 text-sm text-ink/85">{isBn ? 'নতুন প্রকাশিত পাঠ এখানে স্বয়ংক্রিয়ভাবে দেখা যাবে।' : 'Newly published lessons appear here automatically.'}</p>
              </div>
              <Link href={`/${lang}/lessons`} className="link-azure">{isBn ? 'সব পাঠ দেখুন' : 'Browse all lessons'}</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {recentLessons.map((lesson) => (
                <Link key={lesson.id} href={`/${lang}/lessons/${lesson.slug}`} className="routine-tile p-5">
                  <p className="text-sm font-bold">{lesson.title?.[lang] || lesson.title?.en}</p>
                  <p className="mt-2 text-xs opacity-85">{lesson.questionCount} {isBn ? 'টি কুইজ প্রশ্ন' : 'quiz questions'}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* 6 Core Feature Pillars */}
        <section className="landing-features space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl font-extrabold text-ink sm:text-4xl">
              {isBn ? 'দৈনিক রুটিন ও অভ্যাস গড়ার ফিচার' : 'Tools for daily routine planning and habit tracking'}
            </h2>
            <p className="mt-2 text-sm font-medium text-ink/75">
              {isBn ? 'আপনার সময়, কাজ ও শেখার অগ্রগতি এক জায়গায় গুছিয়ে নিন।' : 'Plan your schedule, keep track of tasks, and review your learning progress.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <article key={i} style={{ '--enter-delay': `${i * 70}ms` }} className="routine-tile enter-up p-6">
                <div className="flex items-center justify-between">
                  <span className="brand-orb text-2xl">{f.icon}</span>
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold-soft">{f.tag}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed opacity-90">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ Section — surface-card like app panels */}
        <section className="surface-card space-y-6 p-6 sm:p-10">
          <div className="text-center max-w-xl mx-auto">
            <p className="eyebrow">✦ FAQ</p>
            <h2 className="section-heading justify-center text-2xl sm:text-3xl">
              {isBn ? 'সচরাচর জিজ্ঞাসিত প্রশ্ন (FAQ)' : 'Frequently Asked Questions'}
            </h2>
            <p className="mt-1 text-sm opacity-85">
              {isBn ? 'Smart Routine সম্পর্কে আপনার প্রয়োজনীয় সব উত্তর।' : 'Quick answers about Smart Routine features and security.'}
            </p>
          </div>

          <div className="mt-6 space-y-4 max-w-2xl mx-auto">
            {faqs.map((f, i) => (
              <div key={i} className="routine-tile p-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="brand-spark">✦</span> {f.q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed opacity-80 pl-5">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final Conversion CTA */}
        <section
          className="app-hero relative isolate overflow-hidden rounded-3xl p-8 text-center sm:p-14 shadow-2xl"
        >
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/15 px-3.5 py-1 text-xs font-bold text-gold">
              <span className="brand-spark">✦</span>
              <span>{isBn ? 'সহজ সূচনা' : 'Instant Start'}</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-ink tracking-tight">
              {isBn ? 'আজই শুরু করুন আপনার প্রথম অভ্যাস' : 'Start with One Small Habit Today'}
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-ink/85 max-w-lg mx-auto">
              {isBn ? 'কোনো জটিলতা নেই। এক মিনিটেই রুটিন সেট করুন এবং এআই কোচের সাথে এগিয়ে যান।' : 'No complicated setups. Set your routine in 60 seconds and stay consistent.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/app"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 px-7 py-3.5 text-base font-black text-slate-950 shadow-[0_0_24px_rgba(242,193,78,0.5)] transition-all hover:scale-[1.03] active:scale-95"
              >
                <span>🚀</span>
                <span>{isBn ? 'বিনামূল্যে শুরু করুন' : 'Get Started for Free'}</span>
              </Link>
              <a
                href={ANDROID_APK_DOWNLOAD_URL}
                download
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-gold/60 bg-paper/80 backdrop-blur-md px-6 py-3.5 text-sm font-bold text-ink shadow-lg transition-all hover:border-gold hover:bg-gold/15 hover:scale-[1.02] active:scale-95"
              >
                <span>📱</span>
                <span>{home.ctaAndroid}</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
