import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, pageMetadata, DEFAULT_LANG, BRAND, absUrl, SITE_URL, breadcrumbData } from '../../../lib/seo.js';
import { getDictionary } from '../../../i18n/dictionaries.js';
import { JsonLd } from '../../../components/JsonLd.jsx';
import { getIslamicReflection, getLandingQuizzes, getLessons, getTodayLesson } from '../../../lib/api.js';
import { BRAND_BACKGROUND_URL } from '../../../lib/branding.js';
import { AudioDramaPlayer } from '../../../components/AudioDramaPlayer.jsx';
import { LandingQuizGrid } from '../../../components/LandingQuizGrid.jsx';
import { StoryReader } from '../../../components/StoryReader.jsx';

export const revalidate = 60;

export async function generateMetadata(props) {
  const params = await props.params;
  if (!isLang(params.lang)) return {};
  const isBn = params.lang === 'bn';
  const title = isBn 
    ? 'স্মার্ট রুটিন — এআই হ্যাবিট কোচ ও দৈনিক রুটিন প্ল্যানার'
    : 'Smart Routine — AI Habit Coach & Daily Routine Planner';
  const description = isBn
    ? 'দৈনিক এআই পাঠ, ৫-মিনিটের মাইক্রো রুটিন, বাৎসরিক হিটম্যাপ ও এআই ভয়েস ব্রিফিং সহ আধুনিক রুটিন ট্র্যাকার। সম্পূর্ণ ফ্রি ও অফলাইন-ফার্স্ট।'
    : 'Build lasting habits with daily AI lessons, 5-minute adaptive re-planning, 365-day heatmaps, and audio coaching. Free & offline-friendly.';
  return pageMetadata({ lang: params.lang, path: '', title: `${title} | ${BRAND}`, description });
}

export default async function HomePage(props) {
  const params = await props.params;
  if (!isLang(params.lang)) notFound();
  const lang = params.lang;
  const isBn = lang === 'bn';
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
      tag: 'এআই লার্নিং',
      title: 'দৈনিক এআই পাঠ ও কুইজ',
      desc: 'প্রতিদিনের ছোট, সহজবোধ্য গল্পে বাস্তব জীবনের চরিত্র ও সংলাপ—সাথে গল্পভিত্তিক ৩ প্রশ্নের কুইজ।',
    },
    {
      icon: '⚡',
      tag: 'স্ট্রিক সেভার',
      title: '৫-মিনিটের অ্যাডাপ্টিভ রি-প্ল্যান',
      desc: 'ব্যস্ত বা ক্লান্ত দিনে রুটিন যাতে ভেঙে না যায়, সেজন্য এআই তৎক্ষণাৎ যেকোনো কাজের ৫ মিনিটের সহজ বিকল্প তৈরি করে দেয়।',
    },
    {
      icon: '📊',
      tag: 'গভীর বিশ্লেষণ',
      title: '৩৬৫ দিনের বাৎসরিক হিটম্যাপ',
      desc: 'গিটহাব-স্টাইল ভিজ্যুয়াল গ্রিডে দেখুন আপনার সারাবছরের অভ্যাসের ধারাবাহিকতা এবং কোন কোন দিন আপনি সবচেয়ে বেশি সক্রিয় ছিলেন।',
    },
    {
      icon: '🎧',
      tag: 'অডিও কোচ',
      title: 'গল্প শুনুন নিজের ডিভাইসের কণ্ঠে',
      desc: 'গল্পের সংলাপ ব্রাউজারের speech synthesis দিয়ে শুনুন—অতিরিক্ত paid voice API ছাড়াই।',
    },
    {
      icon: '🏅',
      tag: 'গ্যামিফিকেশন',
      title: 'মাইলফলক ব্যাজ ও এক্সপি',
      desc: 'প্রতিটি রুটিন সম্পন্ন করলেই অর্জিত হবে এক্সপি পয়েন্ট। আনলক করুন প্রভাতী সাধক, সপ্তপদ ধারা ও শতকের সাধনার মতো অনন্য ব্যাজ।',
    },
    {
      icon: '🕌',
      tag: 'ইনক্লুসিভ ফিচার',
      title: 'নামাজের ওয়াক্ত ও সরকারি ছুটি',
      desc: 'সম্পূর্ণ ঐচ্ছিক টগল—ব্যস্ত দিনের মাঝে ৫ ওয়াক্ত নামাজের সঠিক সময়সূচী এবং বাংলাদেশের ক্যালেন্ডার ছুটি অনুযায়ী রুটিন সমন্বয়।',
    },
  ] : [
    {
      icon: '🧠',
      tag: 'AI Learning',
      title: 'Daily AI Lessons & Quizzes',
      desc: 'A short, simple daily story with realistic characters, followed by a three-question quiz based on what happened.',
    },
    {
      icon: '⚡',
      tag: 'Streak Shield',
      title: '5-Minute Adaptive Re-planning',
      desc: 'Too busy for a 45-minute routine? The AI instantly generates a 5-minute micro action so your streak never collapses.',
    },
    {
      icon: '📊',
      tag: 'Visual Analytics',
      title: '365-Day Annual Habit Heatmap',
      desc: 'GitHub-style activity grid showing your habit completion intensity across every day of the calendar year.',
    },
    {
      icon: '🎧',
      tag: 'Audio Coach',
      title: 'Listen to the story in your device voice',
      desc: 'Play dialogue stories with your browser’s speech synthesis—without a paid voice API.',
    },
    {
      icon: '🏅',
      tag: 'Gamification',
      title: 'Milestone Badges & XP Levels',
      desc: 'Earn XP on every completed routine. Level up and collect coveted badges from Early Bird to Century Club.',
    },
    {
      icon: '🕌',
      tag: 'Cultural Context',
      title: 'Prayer Times & Holidays Sync',
      desc: 'Completely optional toggle: track daily prayer times and adapt your routines around Bangladesh national holidays.',
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
        {/* Hero Section — matches app-hero in globals.css */}
        <section
          className="landing-hero app-hero relative isolate overflow-hidden rounded-3xl border border-gold/60 p-6 shadow-xl sm:p-12"
          style={{
            backgroundImage: `linear-gradient(100deg, rgb(0 0 0 / 72%), rgb(0 0 0 / 30%)), url("${BRAND_BACKGROUND_URL}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="max-w-2xl">
            <div className="eyebrow inline-flex items-center gap-2">
              <span className="brand-spark">✦</span>
              <span>{isBn ? 'দক্ষিণ এশিয়ার প্রথম ইন্টেলিজেন্ট হ্যাবিট কোচ' : 'South Asia’s First Intelligent Habit Coach'}</span>
            </div>

            <h1 className="display-1 mt-4 max-w-2xl">
              {isBn ? 'প্রতিদিনের ছোট পদক্ষেপে গড়ে তুলুন অটল ভবিষ্যৎ' : 'Make Room for the Routines that Move You Forward'}
            </h1>

            <p className="hero-description mt-4 text-base font-medium leading-relaxed sm:text-lg">
              {isBn 
                ? 'দৈনিক এআই পাঠ, ৫-মিনিটের মাইক্রো রুটিন, বাৎসরিক হিটম্যাপ ও এআই ভয়েস ব্রিফিং—সবকিছু এক জায়গায়। কোনো বিভ্রান্তি নেই, শুধুই ধারাবাহিক অগ্রগতি।'
                : 'Plan your day with adaptive routines, daily AI habit lessons, 365-day heatmaps, and voice briefings—all in one calm, mobile-friendly app.'}
            </p>

            <div className="landing-actions mt-8 flex flex-wrap items-center gap-3">
              <Link href="/app" className="landing-button primary-button bg-sapphire px-6 py-3 font-bold text-on-sapphire">
                {isBn ? '🚀 বিনামূল্যে অ্যাকাউন্ট খুলুন' : '🚀 Create Free Account'}
              </Link>
              <Link href={`/${lang}/lessons`} className="landing-button secondary-button px-5 py-3 font-semibold">
                {isBn ? '📚 আজকের পাঠ পড়ুন' : '📚 Explore Habit Lessons'}
              </Link>
            </div>

            <p className="mt-4 text-xs font-semibold text-white/80">
              ✓ {isBn ? 'কোনো ক্রেডিট কার্ড লাগবে না · ১০০% ফ্রি · বাংলা ও ইংরেজি' : 'No credit card needed · Free forever · Bangla & English'}
            </p>
          </div>

          {/* Interactive Preview Widget — same tokens as app routine tiles */}
          <div className="surface-card mt-8 p-5 lg:mt-0" aria-hidden="true">
            <div className="flex items-center justify-between border-b border-gold/20 pb-3 text-xs font-bold">
              <span className="eyebrow">✦ {isBn ? 'আজকের ফোকাস রুটিন' : "Today's Focus"}</span>
              <span className="rounded-full border border-gold/50 bg-gold/15 px-2.5 py-0.5 text-gold-soft">🔥 7-Day Streak</span>
            </div>

            <div className="mt-3 space-y-2.5">
              <div className="routine-tile flex items-center justify-between p-2.5 text-sm font-semibold">
                <span className="flex items-center gap-2">✅ <span>{isBn ? 'সকালের হাঁটা ও মেডিটেশন' : 'Morning Walk & Mind'}</span></span>
                <span className="text-xs font-mono opacity-85">06:30</span>
              </div>
              <div className="focus-routine-row text-sm font-semibold">
                <span className="flex items-center gap-2">⚡ <span>{isBn ? 'গণিত স্টাডি (৫-মি. সংস্করণ)' : 'Deep Work (5m micro)'}</span></span>
                <span className="text-xs font-mono">09:00</span>
              </div>
              <div className="routine-tile flex items-center justify-between p-2.5 text-sm font-semibold">
                <span className="flex items-center gap-2">🎧 <span>{isBn ? 'ঘুমের প্রস্তুতি এআই পাঠ' : 'Sleep Foundation Lesson'}</span></span>
                <span className="text-xs font-mono opacity-85">22:00</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 p-2.5 text-xs font-bold">
              <span>🌟 {isBn ? 'লেভেল ২ · অটল শিক্ষার্থী' : 'Level 2 · Steadfast Learner'}</span>
              <span>180/200 XP</span>
            </div>
          </div>
        </section>

        <section id="daily-story" className="surface-card scroll-mt-8 overflow-hidden">
          <div className="border-b border-gold/20 px-6 py-5 sm:px-8">
            <p className="eyebrow">
              {isBn ? '🌙 প্রতিদিন রাত ১২টায় নতুন গল্প ও কুইজ' : '🌙 A new story and quiz every night at midnight'}
            </p>
            <h2 className="section-heading mt-2 text-2xl sm:text-3xl">
              {dailyLesson?.title || (isBn ? 'আজকের গল্প শিগগিরই আসছে' : "Today's story is coming soon")}
            </h2>
            {dailyLesson?.description ? <p className="mt-2 max-w-3xl text-sm leading-relaxed opacity-80">{dailyLesson.description}</p> : null}
          </div>

          {dailyLesson ? (
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_.8fr]">
              <div>
                <h3 className="section-heading text-lg">{isBn ? 'আজকের ছোট গল্প' : "Today's short story"}</h3>
                <div className="routine-tile mt-3 p-3 sm:p-4">
                  <StoryReader
                    lines={dailyLesson.content.split(/\r?\n/).filter(Boolean).map((line) => {
                      const match = line.match(/^\[([^\]]+)\]\s*:\s*(.*)$/);
                      return match ? { speaker: match[1], text: match[2] } : { speaker: null, text: line };
                    })}
                    vocabulary={dailyLesson.vocabulary || []}
                    lang={lang}
                    keyTakeaway={dailyLesson.keyTakeaway || ''}
                    description={dailyLesson.description || ''}
                  />
                </div>
                <AudioDramaPlayer title={dailyLesson.title} content={dailyLesson.content} lang={lang} />
              </div>

              <aside className="routine-tile p-4 sm:p-5">
                <h3 className="section-heading text-lg">{isBn ? 'গল্প থেকে কুইজ' : 'Quick story quiz'}</h3>
                {dailyQuiz?.questions?.length ? (
                  <ol className="mt-3 space-y-4">
                    {dailyQuiz.questions.map((question, questionIndex) => (
                      <li key={questionIndex} className="rounded-xl border border-gold/20 bg-paper/60 p-3">
                        <p className="text-sm font-semibold">{questionIndex + 1}. {question.text}</p>
                        <ul className="mt-2 space-y-1 text-sm opacity-80">
                          {question.options.map((option, optionIndex) => (
                            <li key={optionIndex}>{String.fromCharCode(65 + optionIndex)}. {option.text}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-3 text-sm opacity-80">{isBn ? 'কুইজ তৈরি হচ্ছে।' : 'The quiz is being prepared.'}</p>}
                <Link href="/app" className="primary-button mt-5 inline-flex w-full justify-center bg-sapphire px-5 py-3 text-center font-bold text-on-sapphire">
                  {isBn ? 'নিজের রুটিন তৈরি করে শুরু করুন' : 'Create a free account to get started'}
                </Link>
                <p className="mt-2 text-center text-xs opacity-85">
                  {isBn ? 'বিনামূল্যে · বাংলা ও ইংরেজি · আপনার পছন্দমতো ভয়েসে শুনুন' : 'Free to start · Bangla and English · Listen with your device voice'}
                </p>
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

        <section className="surface-card grid grid-cols-2 gap-4 p-6 text-center sm:grid-cols-4">
          <div><p className="text-2xl font-black text-gold sm:text-3xl">🌙</p><p className="mt-1 text-xs font-medium opacity-90">{isBn ? 'প্রতিদিন নতুন গল্প' : 'A fresh daily story'}</p></div>
          <div><p className="text-2xl font-black text-sapphire sm:text-3xl">🧩</p><p className="mt-1 text-xs font-medium opacity-90">{isBn ? 'গল্পভিত্তিক কুইজ' : 'Story-based quizzes'}</p></div>
          <div><p className="text-2xl font-black text-gold sm:text-3xl">🎧</p><p className="mt-1 text-xs font-medium opacity-90">{isBn ? 'শুনে শেখার সুবিধা' : 'Listen as you learn'}</p></div>
          <div><p className="text-2xl font-black text-sapphire sm:text-3xl">🇧🇩</p><p className="mt-1 text-xs font-medium opacity-90">{isBn ? 'বাংলা ও ইংরেজি' : 'Bangla and English'}</p></div>
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
              {isBn ? 'একটি অ্যাপ, অভ্যাসের সম্পূর্ণ ইকোসিস্টেম' : 'One Calm App, A Complete Habit Ecosystem'}
            </h2>
            <p className="mt-2 text-sm font-medium text-ink/75">
              {isBn ? 'জটিলতা পরিহার করে বাস্তব জীবনের জন্য ডিজাইন করা আধুনিক ফিচারসমূহ।' : 'Designed for real life with tools that protect habit momentum.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <article key={i} className="routine-tile p-6">
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

        {/* Final Conversion CTA — brand banner + app-hero */}
        <section
          className="app-hero relative isolate overflow-hidden p-8 text-center sm:p-14"
          style={{
            backgroundImage: `linear-gradient(100deg, rgb(0 0 0 / 72%), rgb(0 0 0 / 30%)), url("${BRAND_BACKGROUND_URL}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <p className="eyebrow mx-auto">✦ {isBn ? 'শুরু করুন' : 'Get started'}</p>
          <h2 className="display-2 text-gold-shine mt-3">
            {isBn ? 'আজই শুরু করুন আপনার প্রথম অভ্যাস' : 'Start with One Small Habit Today'}
          </h2>
          <p className="hero-description mt-3 text-sm sm:text-base max-w-lg mx-auto">
            {isBn ? 'কোনো জটিলতা নেই। এক মিনিটেই রুটিন সেট করুন এবং এআই কোচের সাথে এগিয়ে যান।' : 'No complicated setups. Set your routine in 60 seconds and stay consistent.'}
          </p>
          <div className="mt-6">
            <Link href="/app" className="primary-button inline-flex bg-sapphire px-7 py-3.5 text-base font-bold text-on-sapphire">
              {isBn ? '🚀 বিনামূল্যে শুরু করুন' : '🚀 Get Started for Free'}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
